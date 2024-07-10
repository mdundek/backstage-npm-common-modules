import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { BackstageComponentRegistrar } from './backstageRegistrar';
import { ArgoClient } from './argo';
import { gitlab } from './gitlab';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

class AxionController extends ControllerBase {
    public k8sClient: KubernetesClient;
    public argoClient: ArgoClient;

    /**
     * 
     * @param k8sHost 
     * @param k8sSaToken 
     */
    constructor(k8sHost: string, k8sSaToken: string) {
        super();
        this.k8sClient = new KubernetesClient(k8sHost, k8sSaToken)
        this.argoClient = new ArgoClient(k8sHost, k8sSaToken)
    }

    /**
     * 
     * @param clusterEntity 
     * @param dnsEntity 
     * @param gcpProjectId 
     * @param ctx 
     * @returns 
     */
    public computeArgumentsFile(clusterEntity: any, dnsEntity: any, gcpProjectId: string, ctx: any): any {
        // Prepare the Argo Workflow arguments for the Axion installation
        const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAxionSecretsWithVault : false;
        const rootDomain = dnsEntity.spec.isDnsSubdomain ? `${dnsEntity.spec.subdomain}.${dnsEntity.spec.domain}` : dnsEntity.spec.domain;
        const args = {
            "axionSystemNamespace": "axion-system",
            "clusterRootDomain": rootDomain,
            "setupSecretName": "temporary-axion-credentials",
            "gcpProjectId": gcpProjectId,
            "axionOciRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
            "axionOciRepoAuth": true,
            "manageSecretsWithVault": manageSecretsWithVault,
            "configureVaultAuth": manageSecretsWithVault,
            "pushVaultSecrets": manageSecretsWithVault,
            "proxyBaseCharts": true,
            "proxyBaseChartsRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
            "proxyRegUseAuth": true,
            "argoCdManaged": ctx.input.installArgocd ? ctx.input.manageWithArgocd : false,
            "vaultServer": manageSecretsWithVault ? ctx.input.vaultEnvironment : "",
            "vaultNamespace": manageSecretsWithVault ? ctx.input.vaultNamespace : "",
            "vaultPolicyName": "axion-creds-secret-policy",
            "cloudCredsVaultSecretName": "cloud-acc-creds-secret",
            "ociCredsVaultSecretName": "oci-reg-creds-secret",
            "vaultAxionK8sSaName": "axion-k8s-vault",
            "vaultAxionClusterSecretStoreName": "axion-cluster-secret-store",
            "vaultAxionRoleName": "axion-volt-role",
            "vaultAxionKubernetesAuthPath": "kubernetes-axion-system",
            "k8sAuthHost": clusterEntity.spec.data.host,
            "installExternalSecrets": ctx.input.installExternalSecrets,
            "installArgoCd": ctx.input.installArgocd,
            "installCertManager": ctx.input.installCertManager,
            "installExternalDns": ctx.input.installExternalDns,
            "installIstio": ctx.input.installIstio,
            "createSelfSignedDefaultClusterIssuer": false,
            "createRootDomainAxionClusterIssuer": ctx.input.installCertManager,
            "certManagerEaDnsNameserver": "10.12.238.27:53",
            "certManagerValues": "installCRDs: true\nenableCertificateOwnerRef: true",
            "externalDnsValues": `provider: google\ngoogle:\n  project: ${gcpProjectId}\nsources:\n  - istio-gateway`,
            "istiodValues": "meshConfig:\n  enableAutoMtls: true\n  rootNamespace: istio-system\nconfigMapEnabled: true \nrevision: pilot",
            "istioGatewayValues": "revision: \"pilot\"\nservice:\n  annotations:\n    cloud.google.com/load-balancer-type: \"Internal\"",
            "argoCdValues": "configs:\n  params:\n    server.insecure: true\nserver:\n  certificate:\n    enabled: false",
            "createBackstageCatalogEntry": "true",
            "dependsOnClusterCompRef": `component:${clusterEntity.metadata.namespace}/${clusterEntity.metadata.name}`,
            "dependsOnDnsCompRef": `component:${dnsEntity.metadata.namespace}/${dnsEntity.metadata.name}`,
            "createRootDomainDefaultCertificate": ctx.input.createDefaultRootDomainCertificate,
            "rootDomainDefaultCertificateTargetIssuer": "letsencrypt-axion-rootdomain",
            "rootDomainDefaultCertificateName": "axion-rootdomain-crt"
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
    public async createAxionSystemNamespace() {
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/axion-system`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces`, {
                "apiVersion": "v1",
                "kind": "Namespace",
                "metadata": {
                  "name": "axion-system"
                }
            })
        }
    }

    /**
     * validateCredentials
     * @param ctx 
     * @param nakedRepo 
     * @param k8sSaToken 
     * @param k8sHost 
     */
    public async validateCredentials(
        ctx: any, 
        nakedRepo: string, 
        k8sSaToken: string, 
        k8sHost: string
    ) {
        ctx.logger.info(' => Validating credentials and basic access...');
        const authErrors = [];
        const cloudCredsValid = await this.testGcpCloudCreds(ctx.input.cloudCredentials);
        const ociCredsValid = await this.testOciCreds(nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);
        if (ctx.input.manageAxionSecretsWithVault) {
            const vaultCredsValid = await this.testVaultCreds(ctx.input.vaultTemporaryToken, ctx.input.vaultEnvironment, ctx.input.vaultNamespace);
            if (!vaultCredsValid) {
                authErrors.push("- Your Vault credentials are invalid");
            }
        }
        const checkKubeapi = await this.testKubeToken(k8sSaToken, k8sHost);
        if (!cloudCredsValid) {
            authErrors.push("- Your cloud credentials are invalid");
        }
        if (!ociCredsValid) {
            authErrors.push("- Your OCI credentials are invalid");
        }
        if (!checkKubeapi) {
            authErrors.push("- Your target cluster token is invalid");
        }
        if (authErrors.length > 0) {
            throw new Error(`The following errors were found:\n${authErrors.join("\n")}`);
        }
    }

    /**
     * 
     * @param ctx 
     * @param clusterEntity 
     * @param dnsEntity 
     * @param k8sHost 
     * @param workflowFilePath 
     */
    public async prepareWorkflow(
        ctx: any, 
        clusterEntity: any, 
        dnsEntity: any, 
        k8sHost: string
    ) {
        // Generate a unique name for the workflow
        let uid = new ShortUniqueId({ length: 5 });
        let uidGen = uid.rnd().toLowerCase();

        // Fetch the Axion workflow from the Axion workflow repository
        // NOTE: We do not use the target cluster to initiate this here because
        //       it queires the backstage Kube API to get the gitlab credentials,
        //       those are located on this cluster
        ctx.logger.info(' => Fetching Axion workflow from the Axion workflow repository...');
        const workflow: any = await new ArgoClient().fetchWorkflowFromWorkflowRepo('axion/axion-install-proxy.yaml');
        // Compute the arguments for the Axion installation
        ctx.logger.info(' => Preparing for Axion installation...');

        // Update the workflow with the computed arguments
        const args = this.computeArgumentsFile(clusterEntity, dnsEntity, JSON.parse(ctx.input.cloudCredentials).project_id, ctx);

        const updatedWorkflowTmp = this.updateWorkflowSpecArguments(workflow, args);

        const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAxionSecretsWithVault : false;
        // ArgoCD
        const argoCdRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmRepo').value;	
        const argoCdChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmChart').value;
        const argoCdVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmVersion').value;

        // ExternalSecrets
        const externalSecretsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmRepo').value;	
        const externalSecretsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmChart').value;
        const externalSecretsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmVersion').value;
        const clusterSecretStoreName = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'vaultAxionClusterSecretStoreName').value;

        // CertManager
        const certManagerRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmRepo').value;	
        const certManagerChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmChart').value;
        const certManagerVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmVersion').value;
        const certManagerRootClusterIssuer = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'rootDomainAxionClusterIssuerName').value;
        const createRootDomainDefaultCertificate = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'createRootDomainDefaultCertificate').value;
        const rootDomainDefaultCertificateName = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'rootDomainDefaultCertificateName').value;
       
        // ExternalDns
        const externalDnsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmRepo').value;	
        const externalDnsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmChart').value;
        const externalDnsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmVersion').value;
        const externalDnsClusterRootDomain = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'clusterRootDomain').value;

        // Istio
        const istioGatewayRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmRepo').value;	
        const istioGatewayChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmChart').value;
        const istioGatewayVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmVersion').value;

        // Crossplane
        const crossplaneRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmRepo').value;	
        const crossplaneChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmChart').value;
        const crossplaneVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmVersion').value;
        const gcpProviderConfigName = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'gcpProviderConfigName').value;

        args.uuid = uidGen;
        args.gitlabCredsSecretName = "backstage-secrets"
        args.gitlabCredsSecretNamespace = "backstage-system"
        args.resourceOwnerRef = ctx.input.catalogOwnerRef;
        args.targetBackstageSystem = ctx.input.targetSystem;
        args.targetBackstageSystemNormalized = BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
        args.normalizedName = ctx.input.name;
        args.backstageSpecOther = yaml.dump({
            "data": {
                "cloudProvider": dnsEntity.spec.cloudProvider,
                "k8sCatalogRef": ctx.input.targetCluster,
                "dnsCatalogRef": ctx.input.rootDnsHost,
                "kubeApiHost": k8sHost,
                "gcpProjectId": clusterEntity.spec.data.projectId,
                "oci": {
                    "ociRepo": clusterEntity.spec.data.ociRepo,
                    "ociUsername": ctx.input.ociAuthUsername,
                },
                "vault": {
                    "vaultNamespace": manageSecretsWithVault ? ctx.input.vaultNamespace : "",
                    "vaultEnvironment": manageSecretsWithVault ? ctx.input.vaultEnvironment : "",
                },
                "features": {
                    "istio": {
                        "installed": ctx.input.installIstio,
                        "repo": istioGatewayRepo,
                        "chart": istioGatewayChart,
                        "version": istioGatewayVersion,
                    },
                    "externalDns": {
                        "installed": ctx.input.installExternalDns,
                        "repo": externalDnsRepo,
                        "chart": externalDnsChart,
                        "version": externalDnsVersion,
                        "clusterRootDomain": externalDnsClusterRootDomain
                    },
                    "certManager": {
                        "installed": ctx.input.installCertManager,
                        "repo": certManagerRepo,
                        "chart": certManagerChart,
                        "version": certManagerVersion,
                        "clusterIssuer": certManagerRootClusterIssuer,
                        "rootDomainDefaultCertificateCreated": createRootDomainDefaultCertificate,
                        "rootDomainDefaultCertificateName": rootDomainDefaultCertificateName
                    },
                    "externalSecrets": {
                        "installed": ctx.input.installExternalSecrets,
                        "repo": externalSecretsRepo,
                        "chart": externalSecretsChart,
                        "version": externalSecretsVersion,
                        "clusterSecretStoreName": clusterSecretStoreName
                    },
                    "argoCd": {
                        "installed": ctx.input.installArgocd,
                        "repo": argoCdRepo,
                        "chart": argoCdChart,
                        "version": argoCdVersion,
                        "dashboardUrl": `https://argocd.${externalDnsClusterRootDomain}`
                    },
                    "crossplane": {
                        "installed": true,
                        "repo": crossplaneRepo,
                        "chart": crossplaneChart,
                        "version": crossplaneVersion,
                        "gcpProviderConfigName": gcpProviderConfigName
                    },
                    "manageAxionSecretsWithVault": manageSecretsWithVault,
                    "manageWithArgocd": ctx.input.manageWithArgocd ? ctx.input.manageWithArgocd : false,
                }
            }
        })

        const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
        
        const workflowName = `axion-proxy-${ctx.input.name}-${uidGen}`
        updatedWorkflow.metadata.name = workflowName;

        // Convert the JSON object to YAML format
        const yamlContent = yaml.dump(updatedWorkflow);

        uid = new ShortUniqueId({ length: 10 });
        const workflowFilePath = `./${uid.rnd()}-workflow-proxy.yaml`

        // Write the YAML content to the specified file
        await fs.writeFile(workflowFilePath, yamlContent, 'utf-8');

        return {
            uidGen: uidGen,
            workflowFilePath: workflowFilePath,
            workflowName: workflowName
        }
    }

    /**
     * prepareArgoWorkflowDependencies
     * @param ctx 
     * @param dnsEntity 
     * @param nakedRepo 
     * @param k8sSaToken 
     * @param k8sHost 
     * @param uidGen 
     * @returns 
     */
    public async prepareArgoWorkflowDependencies(
        ctx: any, 
        dnsEntity: any, 
        nakedRepo: string, 
        k8sSaToken: string, 
        k8sHost: string,
        uidGen: string
    ) {
        // Create the Axion System namespace if it does not exist
        await this.createAxionSystemNamespace();

        // Prepare the temporary secret for the Axion installation
        try {
            // Make sure we remove secret if it exists first
            await this.k8sClient.fetchSecret("temporary-axion-credentials", "axion-system")
            await this.k8sClient.deleteSecret("temporary-axion-credentials", "axion-system")
        } catch (_) { }

        // Create temporary secret
        await this.k8sClient.applyResource(`/api/v1/namespaces/axion-system/secrets`, {
            apiVersion: "v1",
            data: {
                "TARGET_CLOUD": Buffer.from(dnsEntity.spec.cloudProvider).toString('base64'),
                "GCP_REGION": Buffer.from("us-west1").toString('base64'),
                "GCP_JSON_KEY": Buffer.from(ctx.input.cloudCredentials).toString('base64'),
                "AXION_OCI_REGISTRY_USERNAME": Buffer.from(ctx.input.ociAuthUsername).toString('base64'),
                "AXION_OCI_REGISTRY_PASSWORD": Buffer.from(ctx.input.ociAuthToken).toString('base64'),
                "VAULT_SA_TEMP_TOKEN": ctx.input.vaultTemporaryToken ? Buffer.from(ctx.input.vaultTemporaryToken).toString('base64') : ""
            },
            kind: "Secret",
            metadata: {
                name: "temporary-axion-credentials"
            },
            type: "Opaque"
        });

        // Create the Argo Pull Secret if it does not exist
        await this.createArgoPullSecret(this.k8sClient, nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);

        // Create the Workflow Service Account if it does not exist
        await this.createArgoWorkflowAdminSa(this.k8sClient);

        // Create temporary secret with target cluster creds that the proxy workflow can use to deploy the workflow to
        const k8sClient = new KubernetesClient();
        await k8sClient.applyResource(`/api/v1/namespaces/backstage-system/secrets`, {
            apiVersion: "v1",
            data: {
                "token": Buffer.from(k8sSaToken).toString('base64'),
                "api": Buffer.from(k8sHost).toString('base64')

            },
            kind: "Secret",
            metadata: {
                name: `tmp-${uidGen}`
            },
            type: "Opaque"
        })
        return {
            tmpCredsSecretName: `tmp-${uidGen}`
        };
    }

    /**
     * 
     * @param ctx 
     * @param k8sBackstageClient 
     */
    public async deployAxionWorkflowTemplates(ctx: any, k8sBackstageClient: KubernetesClient) {
        let secretValues = await k8sBackstageClient.getSecretValues('backstage-system', 'backstage-secrets');
			
        const workflowsRepoProjectId = secretValues["GITLAB_AXION_WORKFLOWS_REPO_ID"];
        const branchOrTag = 'dev';
        const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;

        const templateFiles = await gitlab.getFilesFromFolder(
            workflowsRepoProjectId, 
            "axion-argo-workflow/releases/latest/workflow/templates", 
            branchOrTag, 
            personalAccessToken
        );
        for(let templatePath of templateFiles) {
            const templateYaml = await gitlab.fetchFile(workflowsRepoProjectId, templatePath, branchOrTag, personalAccessToken);
            const b64Buffer = Buffer.from(templateYaml.content, 'base64');
            // Parse the YAML content
            ctx.logger.info(` => Applying template ${templatePath}...`);
            // Apply to remote cluster
            await this.k8sClient.applyYaml(b64Buffer.toString('utf-8'))
        }
    }
}

export { AxionController };