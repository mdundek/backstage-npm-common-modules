import { KubernetesClient } from './kubernetes';
import { BackstageComponentRegistrar } from './backstageRegistrar';
import { ArgoClient } from './argo';
import { gitlab } from './gitlab';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import ShortUniqueId from 'short-unique-id';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';

const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';

/**
 * fetchProxy
 * @param url 
 * @param options 
 * @returns 
 */
const fetchProxy = async (url: string, options: any) => {
    // Depending on the KubeAPI host used, the certificate might not be valid.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
        return await fetch(url, options);
    } finally {
        // Reenable right after the call
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
}  

class AmpController {
    private k8sClient: KubernetesClient;
    private argoClient: ArgoClient;

    /**
     * 
     * @param k8sHost 
     * @param k8sSaToken 
     */
    constructor(k8sHost?: string, k8sSaToken?: string) {
        this.k8sClient = new KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
        this.argoClient = new ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN)
    }

    /**
     * prepareTemporarySecret
     * @param cloudCredentials 
     * @param cloudProvider 
     * @param gitlabAuthToken 
     */
    public async prepareTemporarySecret(
        cloudCredentials: string,
        gitlabGroupAuthToken: string,
        cloudProvider: string,
        gcpRegion: string
    ) {
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
                "GCP_JSON_KEY": Buffer.from(cloudCredentials).toString('base64'),
                "GITLAB_TOKEN": Buffer.from(gitlabGroupAuthToken).toString('base64')
            },
            kind: "Secret",
            metadata: {
                name: "temporary-amp-credentials"
            },
            type: "Opaque"
        });
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
        terraformCleanupBeforeCreate: boolean
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
            "tempSecretName": "temporary-amp-credentials",
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
     * @param workflow 
     * @param replacements 
     * @returns 
     */
    public updateWorkflowSpecArguments(workflow: any, replacements: any): any {
        // Clone the workflow to avoid mutating the original object
        let updatedWorkflow = JSON.parse(JSON.stringify(workflow));

        // Iterate over the parameters in the workflow spec arguments
        if (updatedWorkflow.spec && updatedWorkflow.spec.arguments && updatedWorkflow.spec.arguments.parameters) {
            updatedWorkflow.spec.arguments.parameters = updatedWorkflow.spec.arguments.parameters.map((param: any) => {
                // Check if the param name exists in the replacements object
                if (replacements.hasOwnProperty(param.name)) {
                    // Update the value if there is a matching key in replacements
                    return {
                        ...param,
                        value: replacements[param.name]
                    };
                }
                return param;
            });
        }

        return updatedWorkflow;
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
    public async createArgoWorkflowAdminSa() {
        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/serviceaccounts/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces/argo/serviceaccounts`, {
                "apiVersion": "v1",
                "imagePullSecrets": [
                    {
                      "name": "argo-sa-regcreds"
                    }
                ],
                "kind": "ServiceAccount",
                "metadata": {
                    "name": "argo-admin",
                    "namespace": "argo"
                
                }
            })
        }

        try {
            await this.k8sClient.fetchRaw(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/argo-admin-binding`);
        } catch (error) {

            await this.k8sClient.applyResource(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "ClusterRoleBinding",
                "metadata": {
                    "name": "argo-admin-binding"
                },
                "roleRef": {
                    "apiGroup": "rbac.authorization.k8s.io",
                    "kind": "ClusterRole",
                    "name": "cluster-admin"
                },
                "subjects": [
                    {
                        "kind": "ServiceAccount",
                        "name": "argo-admin",
                        "namespace": "argo"
                    }
                ]
            })
            
        }

        try {
            await this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-admin`);
        } catch (error) {
            // Does not exist, create SA
            await this.k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
                "apiVersion": "v1",
                "kind": "Secret",
                "metadata": {
                    "name": "argo-admin",
                    "namespace": "argo",
                    "annotations": {
                        "kubernetes.io/service-account.name": "argo-admin"
                    }
                },
                "type": "kubernetes.io/service-account-token"
            })
        }
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
     * 
     * @param token 
     * @param kubeApi 
     * @returns 
     */
    public async testKubeToken(token: string, kubeApi: string) {
        const response = await fetchProxy(`${kubeApi}/apis/authentication.k8s.io/v1/tokenreviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                "apiVersion": "authentication.k8s.io/v1",
                "kind": "TokenReview",
                "spec": {
                "token": token
                }
            })
        });
        if (!response.ok) {
            return false
        }
        return true;
    }

    /**
     * 
     * @param command 
     * @param args 
     * @returns 
     */
    // private async runCommand(command: string, args: string[] = []) {
    //     return new Promise((resolve) => {
    //         const process = spawn(command, args);
    //         process.on('close', (exitCode: number) => {
    //             resolve(exitCode);
    //         });
    //     });
    // }

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
            ctx.input.terraformCleanupBeforeCreate ? true : false
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
     * @returns 
     */
    public async prepareArgoWorkflowDependencies(
        ctx: any, 
        cloudProvider: string,
        gcpRegion: string
    ) {
        await this.createWorkflowScriptsConfigMap(ctx)

        // Create the Amp System namespace if it does not exist
        await this.createAmpSystemNamespace();

        // Prepare the temporary secret for the Amp installation
        await this.prepareTemporarySecret(
            ctx.input.cloudCredentials,
            ctx.input.gitlabGroupAuthToken,
            cloudProvider,
            gcpRegion,
        );
    }

    /**
     * 
     * @param ctx 
     * @param k8sBackstageClient 
     */
    private async createWorkflowScriptsConfigMap(ctx: any) {
        const tmpFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'backstage-'));
        try {
            ctx.logger.info(' => Fetching scripts from the workflows repository...');
            let secretValues = await this.k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
                
            const workflowsRepoProjectId = secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID"];
            const branchOrTag = 'main';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;

            let scriptsFiles = await gitlab.getFilesFromFolder(
                workflowsRepoProjectId, 
                "amp/scripts", 
                branchOrTag, 
                personalAccessToken
            );
            for(let scriptPath of scriptsFiles) {
                const scriptCode = await gitlab.fetchFile(workflowsRepoProjectId, scriptPath, branchOrTag, personalAccessToken);
                const b64Buffer = Buffer.from(scriptCode.content, 'base64');

                fs.writeFile(path.join(tmpFolder, path.basename(scriptPath)), b64Buffer, 'utf-8');            
            }
            scriptsFiles = await gitlab.getFilesFromFolder(
                workflowsRepoProjectId, 
                "amp/scripts/libs", 
                branchOrTag, 
                personalAccessToken
            );
            for(let scriptPath of scriptsFiles) {
                const scriptCode = await gitlab.fetchFile(workflowsRepoProjectId, scriptPath, branchOrTag, personalAccessToken);
                const b64Buffer = Buffer.from(scriptCode.content, 'base64');

                fs.writeFile(path.join(tmpFolder, path.basename(scriptPath)), b64Buffer, 'utf-8');            
            }

            // Create ConfigMap from files
            ctx.logger.info(' => Creating ConfigMap from scripts for workflow...');
            const files = await fs.readdir(tmpFolder);
            const scripts:any = {};
            for(let file of files) {
                scripts[file] = await fs.readFile(path.join(tmpFolder, file), 'utf8');
            }

            // Construct the ConfigMap object
            const configMap = {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: {
                    name: 'script-config-map',
                    namespace: 'argo',
                },
                data: scripts,
            };
            await this.k8sClient.deleteResourceIfExists(`/api/v1/namespaces/argo/configmaps/script-config-map`);
            await this.k8sClient.applyResource(`/api/v1/namespaces/argo/configmaps`, configMap);
        } finally {
            await fs.rmdir(tmpFolder, { recursive: true });
        }
    }

    /**
     * 
     * @param ctx 
     */
    public async ensureArgoIsInstalled(ctx: any) {
        const argoNsExists = await this.k8sClient.namespaceExists("argo");
        if (!argoNsExists) {
            await this.k8sClient.createNamespace("argo");
        }
        const argoDeploymentExists = await this.k8sClient.hasDeployment("argo-server", "argo");
        if(!argoDeploymentExists) {
            ctx.logger.info(' => Installing Argo Workflow on target cluster...');
            
            await this.k8sClient.deployRemoteYaml(
                "https://github.com/argoproj/argo-workflows/releases/download/v3.5.7/quick-start-minimal.yaml",
                "argo"
            )
            ctx.logger.info(' => Successfully deployed Argo to the cluster.');
        } else {
            ctx.logger.info(' => Argo Workflow already installed.');
        }
    }

    /**
     * 
     * @param ctx 
     */
    public async deployBackstageCommonWorkflowTemplate(ctx: any) {
        let secretValues = await this.k8sClient.getSecretValues('backstage-system', 'backstage-secrets');

        console.log(secretValues)
			
        const workflowsRepoProjectId = secretValues["GITLAB_AXION_WORKFLOWS_REPO_ID"];
        const branchOrTag = 'dev';
        const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;

        const templateYaml = await gitlab.fetchFile(workflowsRepoProjectId, "axion-argo-workflow/releases/latest/workflow/templates/backstage-common.yaml", branchOrTag, personalAccessToken);
        const b64Buffer = Buffer.from(templateYaml.content, 'base64');
        // Parse the YAML content
        ctx.logger.info(` => Applying template backstage-common.yaml...`);
        // Apply to remote cluster
        this.k8sClient.applyYaml(b64Buffer.toString('utf-8'))
    }
}

export { AmpController };