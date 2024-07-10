import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { BackstageComponentRegistrar } from './backstageRegistrar';
import { ArgoClient } from './argo';
import * as path from 'path';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';


class AmpController extends ControllerBase {
    public k8sClient: KubernetesClient;
    public argoClient: ArgoClient;

    /**
     * 
     * @param k8sHost 
     * @param k8sSaToken 
     */
    constructor(k8sHost?: string, k8sSaToken?: string) {
        super();
        this.k8sClient = new KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
        this.argoClient = new ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
    }

   /**
    public computeArgumentsFile
    * @param ampGitlabGroupId 
    * @param projectTitleName 
    * @param projectDnsName 
    * @param teamMailingListEmail 
    * @param devDnsRootDomain 
    * @param intDnsRootDomain 
    * @param ampDataGitRepoUrl 
    * @param ampCodeGitRepoUrl 
    * @param targetDevCertManagerIssuerName 
    * @param targetDevCertManagerRootCertName 
    * @param targetIntCertManagerIssuerName 
    * @param targetIntCertManagerRootCertName 
    * @param oauthClientId 
    * @param terraformCleanupBeforeCreate 
    * @returns 
    */
    public computeArgumentsFile(
        ampGitlabGroupId: string,
        projectTitleName: string,
        projectDnsName: string,
        teamMailingListEmail: string,
        devDnsRootDomain: string,
        intDnsRootDomain: string,
        ampDataGitRepoUrl: string,
        ampCodeGitRepoUrl: string,
        targetDevCertManagerIssuerName: string,
        targetDevCertManagerRootCertName: string,
        targetIntCertManagerIssuerName: string,
        targetIntCertManagerRootCertName: string,
        oauthClientId: string,
        terraformCleanupBeforeCreate: boolean,
        tempSecretName: string,
    ): any {
        // Prepare the Argo Workflow arguments for the Axion installation
        const args = {
            "ampGitlabGroupId": ampGitlabGroupId,
            "projectTitleName": projectTitleName,
            "projectDnsName": projectDnsName,
            "teamMailingListEmail": teamMailingListEmail,
            "devDnsRootDomain": devDnsRootDomain,
            "intDnsRootDomain": intDnsRootDomain,
            "ampDataGitRepoUrl": ampDataGitRepoUrl,
            "ampCodeGitRepoUrl": ampCodeGitRepoUrl,
            "targetDevCertManagerIssuerName": targetDevCertManagerIssuerName,
            "targetDevCertManagerRootCertName": targetDevCertManagerRootCertName,
            "targetIntCertManagerIssuerName": targetIntCertManagerIssuerName,
            "targetIntCertManagerRootCertName": targetIntCertManagerRootCertName,
            "oauthClientId":  oauthClientId,
            "terraformCleanupBeforeCreate": terraformCleanupBeforeCreate,
            "tempSecretName": tempSecretName,
            "tempSecretNamespace": "amp-system",
            "tempSecretGitlabTokenField": "GITLAB_TOKEN",
            "tempSecretGcpJsonKeyField": "GCP_JSON_KEY",
            "tempSecretGcpRegionField": "GCP_REGION",
            "terraformOutputSecretName": "terraform-output-secret",
            "terraformOutputSecretNamespace": "amp-system",
        };
        return args
    }

    /**
     * 
     * @param ctx 
     * @param workflowFilePath 
     * @param workflowName 
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

    /**
     * 
     */
    public async createAmpSystemNamespace() {
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/amp-system`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces`, {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                  "name": "amp-system"
                }
            })
        }
    }

    /**
     * prepareWorkflow
     * @param ctx 
     * @param devDnsRootDomain 
     * @param intDnsRootDomain 
     * @param targetDevCertManagerIssuerName 
     * @param targetDevCertManagerRootCertName 
     * @param targetIntCertManagerIssuerName 
     * @param targetIntCertManagerRootCertName 
     * @param ampDataGitRepoUrl 
     * @param ampCodeGitRepoUrl 
     * @returns 
     */
    public async prepareWorkflow(
        ctx: any, 
        masterConfigJson: any,
        devDnsRootDomain: string,
        intDnsRootDomain: string,
        targetDevCertManagerIssuerName: string,
        targetDevCertManagerRootCertName: string,
        targetIntCertManagerIssuerName: string,
        targetIntCertManagerRootCertName: string,
        ampDataGitRepoUrl: string,
        ampCodeGitRepoUrl: string
    ) {
        // Generate a unique name for the workflow
        let uid = new ShortUniqueId({ length: 5 });
        let uidGen = uid.rnd().toLowerCase();

        // Fetch the Amp workflow from the Amp workflow repository
        // NOTE: We do not use the target cluster to initiate this here because
        //       it queires the backstage Kube API to get the gitlab credentials,
        //       those are located on this cluster
        ctx.logger.info(' => Fetching Amp workflow from the workflow repository...');
        const workflow: any = await new ArgoClient().fetchWorkflowFromWorkflowRepo('amp/amp-setup.yaml');
        // Compute the arguments for the Amp installation
        ctx.logger.info(' => Preparing for Amp installation...');

        // Update the workflow with the computed arguments
        const args = this.computeArgumentsFile(
            ctx.input.gitlabGroupId,
            ctx.input.projectTitle,
            ctx.input.projectName,
            ctx.input.teamMailingList,
            devDnsRootDomain,
            intDnsRootDomain,
            ampDataGitRepoUrl,
            ampCodeGitRepoUrl,
            targetDevCertManagerIssuerName,
            targetDevCertManagerRootCertName,
            targetIntCertManagerIssuerName,
            targetIntCertManagerRootCertName,
            ctx.input.oauthClientId,
            ctx.input.terraformCleanupBeforeCreate ? true : false,
            `tmp-${uidGen}`
        );

        const gcpProjectId = JSON.parse(ctx.input.cloudCredentials).project_id;

        args.gitlabCredsSecretName = "backstage-secrets"
        args.gitlabCredsSecretNamespace = "backstage-system"
        args.resourceOwnerRef = ctx.input.catalogOwnerRef;
        args.targetBackstageSystem = ctx.input.targetSystem;
        args.targetBackstageSystemNormalized = BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);

        args.ampSpannerNormalizedName = masterConfigJson.config.ci.chunks.find((o: { type: string; }) => o.type == "EnvConfig").value.environments.dev.db.instance.name;
        args.ampSpannerBackstageLinks = `- title: Spanner Instance\n  url: https://console.cloud.google.com/spanner/instances/${args.ampSpannerNormalizedName}/details/databases?project=${gcpProjectId}`
        
        args.ampRedisIntNormalizedName = masterConfigJson.config.ci.chunks.find((o: { type: string; }) => o.type == "EnvConfig").value.environments.integration.memstore.name;
        args.ampRedisIntBackstageLinks = `- title: Redis Integration Instance\n  url: https://console.cloud.google.com/memorystore/redis/locations/us-west1/instances/${args.ampRedisIntNormalizedName}/details/overview?project=${gcpProjectId}`
        
        args.ampSetupNormalizedName = ctx.input.projectName;
        args.ampSetupDependsOnSpannerCompRef = `component:default/amp-spanner-instance-${args.ampSpannerNormalizedName}`;
        args.ampSetupDependsOnRedisIntCompRef = `component:default/amp-redis-${args.ampRedisIntNormalizedName}`
        args.ampSetupDependsOnAxionDevCompRef = ctx.input.axionDevInstanceRef;
        args.ampSetupDependsOnAxionIntCompRef = ctx.input.axionIntInstanceRef;
        args.ampSetupBackstageLinks = `- title: AMP Console\n  url: game.${intDnsRootDomain}:443\n- title: AMP Data repository\n  url: ${ampDataGitRepoUrl}\n- title: AMP Code repository\n  url: ${ampCodeGitRepoUrl}`

        const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
        
        const workflowName = `amp-setup-${ctx.input.projectName}-${uidGen}`
        updatedWorkflow.metadata.name = workflowName;

        // Convert the JSON object to YAML format
        const yamlContent = yaml.dump(updatedWorkflow);

        uid = new ShortUniqueId({ length: 10 });
        const workflowFilePath = `./${uid.rnd()}-workflow-proxy.yaml`

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
     * @param dnsEntity 
     * @returns 
     */
    public async prepareArgoWorkflowDependencies(
        ctx: any, 
        cloudProvider: string,
        gcpRegion: string,
        uidGen: string
    ) {
        await this.createWorkflowScriptsConfigMap(ctx, this.k8sClient)

        // Create the Amp System namespace if it does not exist
        await this.createAmpSystemNamespace();

        // Make sure we remove secret if it exists first
        try {
            await this.k8sClient.fetchSecret("temporary-amp-credentials", "amp-system")
            await this.k8sClient.deleteSecret("temporary-amp-credentials", "amp-system")
        } catch (_) { }

        // Create the temporary-amp-credentials secret
        await this.k8sClient.applyResource(`/api/v1/namespaces/amp-system/secrets`, {
            apiVersion: "v1",
            data: {
                "TARGET_CLOUD": Buffer.from(cloudProvider).toString('base64'),
                "GCP_REGION": Buffer.from(gcpRegion).toString('base64'),
                "GCP_JSON_KEY": Buffer.from(ctx.input.cloudCredentials).toString('base64'),
                "GITLAB_TOKEN": Buffer.from(ctx.input.gitlabGroupAuthToken).toString('base64')
            },
            kind: "Secret",
            metadata: {
                name: `tmp-${uidGen}`
            },
            type: "Opaque"
        });

        return {
            tmpCredsSecretName: `tmp-${uidGen}`
        };
    }
}

export { AmpController };