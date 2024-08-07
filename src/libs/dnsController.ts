import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { BackstageComponentRegistrar } from './backstageRegistrar';
import { ArgoClient } from './argo';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';

const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';

class DNSController extends ControllerBase {
    public k8sClient: KubernetesClient;
    public argoClient: ArgoClient;

    /**
     * constructor
     * @param k8sHost 
     * @param k8sSaToken 
     */
    constructor(k8sHost?: string, k8sSaToken?: string) {
        super();
        this.k8sClient = new KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
        this.argoClient = new ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
    }

    /**
     * computeArgumentsFile
     * @param userAccountProviderSecretNamespace 
     * @param userAccountProviderSecretName 
     * @param gcpProjectId 
     * @param secretNameDomainOwnerAccount 
     * @param secretNamespaceDomainOwnerAccount 
     * @param ctx 
     * @returns 
     */
    public computeArgumentsFile(
        userAccountProviderSecretNamespace: string,
        userAccountProviderSecretName: string,
        gcpProjectId: string,
        secretNameDomainOwnerAccount: string,
        secretNamespaceDomainOwnerAccount: string,
        domainOwnerProviderConfigName: string,
        rootDomainZoneId: string,
        ctx: any): any {

        const systemNormalizedName = BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem)

        // Prepare the Argo Workflow arguments for the Axion installation
        const args = {
            "resourceOwnerRef": ctx.input.userOwnerRef,
            "targetBackstageSystem": ctx.input.targetSystem,
            "targetBackstageSystemNormalized": systemNormalizedName,
            "userCloudProvider": ctx.input.userCloudProvider,
            "domainOwnerAccountId": ctx.input.domainOwnerAccountId,
            "domainOwnerAccountDisplayName": ctx.input.domainOwnerAccountDisplayName,
            "gitlabCredsSecretName": "backstage-secrets",
            "gitlabCredsSecretNamespace": "backstage-system",
            "domain": ctx.input.domain,
            "domainNameNormalized": ctx.input.domain.replaceAll('.', '-'),
            "subdomain": ctx.input.subdomain,
            "route53RegionUserAccount": ctx.input.userAccountRoute53Region,
            "cloudDNSRegionUserAccount": ctx.input.userAccountCloudDNSRegion,
            "gcpProjectId": gcpProjectId,
            "route53RegionDomainOwnerAccount": ctx.input.domainOwnerAccountRoute53Region,
            "rootDomainZoneIdDomainOwnerAccount": rootDomainZoneId,
            "providerConfigNameUserAccount": `${systemNormalizedName}-dns-provider-config`,
            "providerSecretNameUserAccount": userAccountProviderSecretName,
            "providerSecretNamespaceUserAccount": userAccountProviderSecretNamespace,
            "providerConfigNameDomainOwnerAccount": domainOwnerProviderConfigName,
            "providerSecretNameDomainOwnerAccount": secretNameDomainOwnerAccount,
            "providerSecretNamespaceDomainOwnerAccount": secretNamespaceDomainOwnerAccount,
        };

        return args
    }

    /**
     * validateCredentials
     * @param ctx 
     */
    public async validateCredentials(
        ctx: any
    ) {
        ctx.logger.info(' => Validating credentials and basic access...');
        const authErrors = [];
        const cloudCredsValid = await this.testGcpCloudCreds(ctx.input.cloudCredentials);
       
        if (!cloudCredsValid) {
            authErrors.push("- Your cloud credentials are invalid");
        }
   
        if (authErrors.length > 0) {
            throw new Error(`The following errors were found:\n${authErrors.join("\n")}`);
        }
    }

    /**
     * prepareWorkflow
     * @param ctx 
     * @param providerSecretName 
     * @param providerSecretNamespace 
     * @param domainOwnerSecretName 
     * @param domainOwnerSecretNamespace 
     * @param domainOwnerProviderConfigName 
     * @param rootDomainZoneId 
     * @returns 
     */
    public async prepareWorkflow(
        ctx: any,
        providerSecretName: string,
        providerSecretNamespace: string,
        domainOwnerSecretName: string,
        domainOwnerSecretNamespace: string,
        domainOwnerProviderConfigName: string,
        rootDomainZoneId: string
    ) {
        // Generate a unique name for the workflow
        let uid = new ShortUniqueId({ length: 5 });
        let uidGen = uid.rnd().toLowerCase();

        // Fetch the Axion workflow from the Axion workflow repository
        // NOTE: We do not use the target cluster to initiate this here because
        //       it queires the backstage Kube API to get the gitlab credentials,
        //       those are located on this cluster
        ctx.logger.info(' => Fetching Axion workflow from the Axion workflow repository...');
        const workflow: any = await new ArgoClient().fetchWorkflowFromWorkflowRepo('dns/create-hosted-zone.yaml');
        // Compute the arguments for the Axion installation
        ctx.logger.info(' => Preparing for DNS Zone setup...');

        // Update the workflow with the computed arguments
        const args = this.computeArgumentsFile(
            providerSecretNamespace, 
            providerSecretName, 
            JSON.parse(ctx.input.gcp_credentials).project_id,
            domainOwnerSecretName,
            domainOwnerSecretNamespace,
            domainOwnerProviderConfigName,
            rootDomainZoneId,
            ctx
        );

        const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);

        let workflowName = `${uidGen}-route53-hosted-zone`
       
        updatedWorkflow.metadata.name = workflowName;

        // Convert the JSON object to YAML format
        const yamlContent = yaml.dump(updatedWorkflow);

        uid = new ShortUniqueId({ length: 10 });
        const workflowFilePath = `./${uid.rnd()}-workflow.yaml`

        const absolutePath = path.resolve(__dirname, workflowFilePath);

        // Write the YAML content to the specified file
        await fs.writeFile(absolutePath, yamlContent, 'utf-8');

        return {
            uidGen: uidGen,
            workflowFilePath: absolutePath,
            workflowName: workflowName
        }
    }

    /**
     * prepareArgoWorkflowDependencies
     * @param ctx 
     * @param nakedRepo 
     * @param providerSecretName 
     * @param providerSecretNamespace 
     */
    public async prepareArgoWorkflowDependencies(
        ctx: any, 
        nakedRepo: string,
        providerSecretName: string,
        providerSecretNamespace: string
    ) {
        // Prepare the temporary secret for the DNS workflow setup
        // Create the provider secret for AWS
        
        if (ctx.input.userCloudProvider == "AWS") {
            await this.createAwsProviderConfigSecret(
                this.k8sClient,
                providerSecretName,
                providerSecretNamespace,
                ctx.input.aws_access_key_id,
                ctx.input.aws_secret_access_key
            );
        }
        // Create the provider secret for GCP
        else if (ctx.input.userCloudProvider == "GCP") {
            await this.createGcpProviderConfigSecret(
                this.k8sClient,
                providerSecretName,
                providerSecretNamespace,
                ctx.input.gcp_credentials
            )
        }

        // Create the Argo Pull Secret if it does not exist
        await this.createArgoPullSecret(this.k8sClient, nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);

        // Create the Workflow Service Account if it does not exist
        await this.createArgoWorkflowAdminSa(this.k8sClient);

        // Make sure we have latest version of templates deployed
        await this.deployBackstageWorkflowTemplates(ctx, this.k8sClient);
    }

    /**
     * deploy
     * @param ctx 
     * @param workflowFilePath 
     * @param workflowName 
     * @param debug 
     */
    public async deploy(ctx: any, workflowFilePath: string, workflowName: string, debug?: boolean) {
        // Run the workflow
        await this.argoClient.runWorkflow(
            ctx.logger,
            workflowFilePath,
            workflowName,
            false,
            debug
        );
    }
}

export { DNSController };