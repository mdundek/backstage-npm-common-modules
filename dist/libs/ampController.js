"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmpController = void 0;
const kubernetes_1 = require("./kubernetes");
const backstageRegistrar_1 = require("./backstageRegistrar");
const argo_1 = require("./argo");
const gitlab_1 = require("./gitlab");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';
/**
 * fetchProxy
 * @param url
 * @param options
 * @returns
 */
const fetchProxy = (url, options) => __awaiter(void 0, void 0, void 0, function* () {
    // Depending on the KubeAPI host used, the certificate might not be valid.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
        return yield fetch(url, options);
    }
    finally {
        // Reenable right after the call
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
});
class AmpController {
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost, k8sSaToken) {
        this.k8sClient = new kubernetes_1.KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
        this.argoClient = new argo_1.ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
    }
    /**
     * prepareTemporarySecret
     * @param cloudCredentials
     * @param cloudProvider
     * @param gitlabAuthToken
     */
    prepareTemporarySecret(cloudCredentials, gitlabGroupAuthToken, cloudProvider, gcpRegion) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sure we remove secret if it exists first
            try {
                yield this.k8sClient.fetchSecret("temporary-amp-credentials", "amp-system");
                yield this.k8sClient.deleteSecret("temporary-amp-credentials", "amp-system");
            }
            catch (_) { }
            // Create the temporary-amp-credentials secret
            yield this.k8sClient.applyResource(`/api/v1/namespaces/amp-system/secrets`, {
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
    computeArgumentsFile(ampGitlabGroupId, projectTitleName, projectDnsName, teamMailingListEmail, devDnsRootDomain, intDnsRootDomain, ampDataGitRepoUrl, ampCodeGitRepoUrl, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, oauthClientId, terraformCleanupBeforeCreate) {
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
            "oauthClientId": oauthClientId,
            "terraformCleanupBeforeCreate": terraformCleanupBeforeCreate,
            "tempSecretName": "temporary-amp-credentials",
            "tempSecretNamespace": "amp-system",
            "tempSecretGitlabTokenField": "GITLAB_TOKEN",
            "tempSecretGcpJsonKeyField": "GCP_JSON_KEY",
            "tempSecretGcpRegionField": "GCP_REGION",
            "terraformOutputSecretName": "terraform-output-secret",
            "terraformOutputSecretNamespace": "amp-system",
        };
        return args;
    }
    /**
     *
     * @param workflow
     * @param replacements
     * @returns
     */
    updateWorkflowSpecArguments(workflow, replacements) {
        // Clone the workflow to avoid mutating the original object
        let updatedWorkflow = JSON.parse(JSON.stringify(workflow));
        // Iterate over the parameters in the workflow spec arguments
        if (updatedWorkflow.spec && updatedWorkflow.spec.arguments && updatedWorkflow.spec.arguments.parameters) {
            updatedWorkflow.spec.arguments.parameters = updatedWorkflow.spec.arguments.parameters.map((param) => {
                // Check if the param name exists in the replacements object
                if (replacements.hasOwnProperty(param.name)) {
                    // Update the value if there is a matching key in replacements
                    return Object.assign(Object.assign({}, param), { value: replacements[param.name] });
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
    deploy(ctx, workflowFilePath, workflowName, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            // Run the workflow
            yield this.argoClient.runWorkflow(ctx.logger, workflowFilePath, workflowName, false, debug);
        });
    }
    /**
     *
     */
    createArgoWorkflowAdminSa() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/serviceaccounts/argo-admin`);
            }
            catch (error) {
                // Does not exist, create SA
                yield this.k8sClient.applyResource(`/api/v1/namespaces/argo/serviceaccounts`, {
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
                });
            }
            try {
                yield this.k8sClient.fetchRaw(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/argo-admin-binding`);
            }
            catch (error) {
                yield this.k8sClient.applyResource(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
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
                });
            }
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-admin`);
            }
            catch (error) {
                // Does not exist, create SA
                yield this.k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
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
                });
            }
        });
    }
    /**
     *
     */
    createAmpSystemNamespace() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/amp-system`);
            }
            catch (error) {
                // Does not exist, create SA
                yield this.k8sClient.applyResource(`/api/v1/namespaces`, {
                    "apiVersion": "v1",
                    "kind": "Namespace",
                    "metadata": {
                        "name": "amp-system"
                    }
                });
            }
        });
    }
    /**
     *
     * @param token
     * @param kubeApi
     * @returns
     */
    testKubeToken(token, kubeApi) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetchProxy(`${kubeApi}/apis/authentication.k8s.io/v1/tokenreviews`, {
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
                return false;
            }
            return true;
        });
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
    prepareWorkflow(ctx, masterConfigJson, devDnsRootDomain, intDnsRootDomain, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, ampDataGitRepoUrl, ampCodeGitRepoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a unique name for the workflow
            let uid = new short_unique_id_1.default({ length: 5 });
            let uidGen = uid.rnd().toLowerCase();
            // Fetch the Amp workflow from the Amp workflow repository
            // NOTE: We do not use the target cluster to initiate this here because
            //       it queires the backstage Kube API to get the gitlab credentials,
            //       those are located on this cluster
            ctx.logger.info(' => Fetching Amp workflow from the workflow repository...');
            const workflow = yield new argo_1.ArgoClient().fetchWorkflowFromWorkflowRepo('amp/amp-setup.yaml');
            // Compute the arguments for the Amp installation
            ctx.logger.info(' => Preparing for Amp installation...');
            // Update the workflow with the computed arguments
            const args = this.computeArgumentsFile(ctx.input.gitlabGroupId, ctx.input.projectTitle, ctx.input.projectName, ctx.input.teamMailingList, devDnsRootDomain, intDnsRootDomain, ampDataGitRepoUrl, ampCodeGitRepoUrl, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, ctx.input.oauthClientId, ctx.input.terraformCleanupBeforeCreate ? true : false);
            const gcpProjectId = JSON.parse(ctx.input.cloudCredentials).project_id;
            args.gitlabCredsSecretName = "backstage-secrets";
            args.gitlabCredsSecretNamespace = "backstage-system";
            args.resourceOwnerRef = ctx.input.catalogOwnerRef;
            args.targetBackstageSystem = ctx.input.targetSystem;
            args.targetBackstageSystemNormalized = backstageRegistrar_1.BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
            args.ampSpannerNormalizedName = masterConfigJson.config.ci.chunks.find((o) => o.type == "EnvConfig").value.environments.dev.db.instance.name;
            args.ampSpannerBackstageLinks = `- title: Spanner Instance\n  url: https://console.cloud.google.com/spanner/instances/${args.ampSpannerNormalizedName}/details/databases?project=${gcpProjectId}`;
            args.ampRedisIntNormalizedName = masterConfigJson.config.ci.chunks.find((o) => o.type == "EnvConfig").value.environments.integration.memstore.name;
            args.ampRedisIntBackstageLinks = `- title: Redis Integration Instance\n  url: https://console.cloud.google.com/memorystore/redis/locations/us-west1/instances/${args.ampRedisIntNormalizedName}/details/overview?project=${gcpProjectId}`;
            args.ampSetupNormalizedName = ctx.input.projectName;
            args.ampSetupDependsOnSpannerCompRef = `component:default/amp-spanner-instance-${args.ampSpannerNormalizedName}`;
            args.ampSetupDependsOnRedisIntCompRef = `component:default/amp-redis-${args.ampRedisIntNormalizedName}`;
            args.ampSetupDependsOnAxionDevCompRef = ctx.input.axionDevInstanceRef;
            args.ampSetupDependsOnAxionIntCompRef = ctx.input.axionIntInstanceRef;
            args.ampSetupBackstageLinks = `- title: AMP Console\n  url: game.${intDnsRootDomain}:443\n- title: AMP Data repository\n  url: ${ampDataGitRepoUrl}\n- title: AMP Code repository\n  url: ${ampCodeGitRepoUrl}`;
            const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
            const workflowName = `amp-setup-${ctx.input.projectName}-${uidGen}`;
            updatedWorkflow.metadata.name = workflowName;
            // Convert the JSON object to YAML format
            const yamlContent = yaml.dump(updatedWorkflow);
            uid = new short_unique_id_1.default({ length: 10 });
            const workflowFilePath = `./${uid.rnd()}-workflow-proxy.yaml`;
            // Write the YAML content to the specified file
            yield fs.writeFile(workflowFilePath, yamlContent, 'utf-8');
            return {
                uidGen: uidGen,
                workflowFilePath: workflowFilePath,
                workflowName: workflowName
            };
        });
    }
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx, cloudProvider, gcpRegion) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createWorkflowScriptsConfigMap(ctx);
            // Create the Amp System namespace if it does not exist
            yield this.createAmpSystemNamespace();
            // Prepare the temporary secret for the Amp installation
            yield this.prepareTemporarySecret(ctx.input.cloudCredentials, ctx.input.gitlabGroupAuthToken, cloudProvider, gcpRegion);
        });
    }
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    createWorkflowScriptsConfigMap(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmpFolder = yield fs.mkdtemp(path.join(os.tmpdir(), 'backstage-'));
            try {
                ctx.logger.info(' => Fetching scripts from the workflows repository...');
                let secretValues = yield this.k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
                const workflowsRepoProjectId = secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID"];
                const branchOrTag = 'main';
                const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
                let scriptsFiles = yield gitlab_1.gitlab.getFilesFromFolder(workflowsRepoProjectId, "amp/scripts", branchOrTag, personalAccessToken);
                for (let scriptPath of scriptsFiles) {
                    const scriptCode = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, scriptPath, branchOrTag, personalAccessToken);
                    const b64Buffer = Buffer.from(scriptCode.content, 'base64');
                    fs.writeFile(path.join(tmpFolder, path.basename(scriptPath)), b64Buffer, 'utf-8');
                }
                scriptsFiles = yield gitlab_1.gitlab.getFilesFromFolder(workflowsRepoProjectId, "amp/scripts/libs", branchOrTag, personalAccessToken);
                for (let scriptPath of scriptsFiles) {
                    const scriptCode = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, scriptPath, branchOrTag, personalAccessToken);
                    const b64Buffer = Buffer.from(scriptCode.content, 'base64');
                    fs.writeFile(path.join(tmpFolder, path.basename(scriptPath)), b64Buffer, 'utf-8');
                }
                // Create ConfigMap from files
                ctx.logger.info(' => Creating ConfigMap from scripts for workflow...');
                const files = yield fs.readdir(tmpFolder);
                const scripts = {};
                for (let file of files) {
                    scripts[file] = yield fs.readFile(path.join(tmpFolder, file), 'utf8');
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
                yield this.k8sClient.deleteResourceIfExists(`/api/v1/namespaces/argo/configmaps/script-config-map`);
                yield this.k8sClient.applyResource(`/api/v1/namespaces/argo/configmaps`, configMap);
            }
            finally {
                yield fs.rmdir(tmpFolder, { recursive: true });
            }
        });
    }
    /**
     *
     * @param ctx
     */
    ensureArgoIsInstalled(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const argoNsExists = yield this.k8sClient.namespaceExists("argo");
            if (!argoNsExists) {
                yield this.k8sClient.createNamespace("argo");
            }
            const argoDeploymentExists = yield this.k8sClient.hasDeployment("argo-server", "argo");
            if (!argoDeploymentExists) {
                ctx.logger.info(' => Installing Argo Workflow on target cluster...');
                yield this.k8sClient.deployRemoteYaml("https://github.com/argoproj/argo-workflows/releases/download/v3.5.7/quick-start-minimal.yaml", "argo");
                ctx.logger.info(' => Successfully deployed Argo to the cluster.');
            }
            else {
                ctx.logger.info(' => Argo Workflow already installed.');
            }
        });
    }
    /**
     *
     * @param ctx
     */
    deployBackstageCommonWorkflowTemplate(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretValues = yield this.k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
            const workflowsRepoProjectId = secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID:"];
            const branchOrTag = 'main';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
            const templateYaml = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, "core-workflows/templates/backstage-common.yaml", branchOrTag, personalAccessToken);
            const b64Buffer = Buffer.from(templateYaml.content, 'base64');
            // Parse the YAML content
            ctx.logger.info(` => Applying template backstage-common.yaml...`);
            // Apply to remote cluster
            this.k8sClient.applyYaml(b64Buffer.toString('utf-8'));
        });
    }
}
exports.AmpController = AmpController;
