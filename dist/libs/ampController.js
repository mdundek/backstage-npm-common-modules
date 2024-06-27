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
const argo_1 = require("./argo");
const gitlab_1 = require("./gitlab");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
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
    prepareTemporarySecret(cloudCredentials, cloudProvider, gitlabAuthToken) {
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
                    "GCP_REGION": Buffer.from("us-west1").toString('base64'),
                    "GCP_JSON_KEY": Buffer.from(cloudCredentials).toString('base64'),
                    "GITLAB_TOKEN": Buffer.from(gitlabAuthToken).toString('base64')
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
     *
     * @param clusterEntity
     * @param dnsEntity
     * @param gcpProjectId
     * @param ctx
     * @returns
     */
    // public computeArgumentsFile(clusterEntity: any, dnsEntity: any, gcpProjectId: string, ctx: any): any {
    //     // Prepare the Argo Workflow arguments for the Axion installation
    //     const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAxionSecretsWithVault : false;
    //     const rootDomain = dnsEntity.spec.isDnsSubdomain ? `${dnsEntity.spec.subdomain}.${dnsEntity.spec.domain}` : dnsEntity.spec.domain;
    //     const args = {
    //         "axionSystemNamespace": "axion-system",
    //         "clusterRootDomain": rootDomain,
    //         "setupSecretName": "temporary-axion-credentials",
    //         "gcpProjectId": gcpProjectId,
    //         "axionOciRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
    //         "axionOciRepoAuth": true,
    //         "manageSecretsWithVault": manageSecretsWithVault,
    //         "configureVaultAuth": manageSecretsWithVault,
    //         "pushVaultSecrets": manageSecretsWithVault,
    //         "proxyBaseCharts": true,
    //         "proxyBaseChartsRepo": `${clusterEntity.spec.data.ociRepo}/captech-msi/core/axion/mdundek/dev`,
    //         "proxyRegUseAuth": true,
    //         "argoCdManaged": ctx.input.installArgocd ? ctx.input.manageWithArgocd : false,
    //         "vaultServer": manageSecretsWithVault ? ctx.input.vaultEnvironment : "",
    //         "vaultNamespace": manageSecretsWithVault ? ctx.input.vaultNamespace : "",
    //         "vaultPolicyName": "axion-creds-secret-policy",
    //         "cloudCredsVaultSecretName": "cloud-acc-creds-secret",
    //         "ociCredsVaultSecretName": "oci-reg-creds-secret",
    //         "vaultAxionK8sSaName": "axion-k8s-vault",
    //         "vaultAxionClusterSecretStoreName": "axion-cluster-secret-store",
    //         "vaultAxionRoleName": "axion-volt-role",
    //         "vaultAxionKubernetesAuthPath": "kubernetes-axion-system",
    //         "k8sAuthHost": clusterEntity.spec.data.host,
    //         "installExternalSecrets": ctx.input.installExternalSecrets,
    //         "installArgoCd": ctx.input.installArgocd,
    //         "installCertManager": ctx.input.installCertManager,
    //         "installExternalDns": ctx.input.installExternalDns,
    //         "installIstio": ctx.input.installIstio,
    //         "createSelfSignedDefaultClusterIssuer": false,
    //         "createRootDomainAxionClusterIssuer": ctx.input.installCertManager,
    //         "certManagerEaDnsNameserver": "10.12.238.27:53",
    //         "certManagerValues": "installCRDs: true\nenableCertificateOwnerRef: true",
    //         "externalDnsValues": `provider: google\ngoogle:\n  project: ${gcpProjectId}\nsources:\n  - istio-gateway`,
    //         "istiodValues": "meshConfig:\n  enableAutoMtls: true\n  rootNamespace: istio-system\nconfigMapEnabled: true \nrevision: pilot",
    //         "istioGatewayValues": "revision: \"pilot\"\nservice:\n  annotations:\n    cloud.google.com/load-balancer-type: \"Internal\"",
    //         "argoCdValues": "configs:\n  params:\n    server.insecure: true\nserver:\n  certificate:\n    enabled: false",
    //         "createBackstageCatalogEntry": "true",
    //         "dependsOnClusterCompRef": `component:${clusterEntity.metadata.namespace}/${clusterEntity.metadata.name}`,
    //         "dependsOnDnsCompRef": `component:${dnsEntity.metadata.namespace}/${dnsEntity.metadata.name}`
    //     };
    //     return args
    // }
    /**
     *
     * @param workflow
     * @param replacements
     * @returns
     */
    // public updateWorkflowSpecArguments(workflow: any, replacements: any): any {
    //     // Clone the workflow to avoid mutating the original object
    //     let updatedWorkflow = JSON.parse(JSON.stringify(workflow));
    //     // Iterate over the parameters in the workflow spec arguments
    //     if (updatedWorkflow.spec && updatedWorkflow.spec.arguments && updatedWorkflow.spec.arguments.parameters) {
    //         updatedWorkflow.spec.arguments.parameters = updatedWorkflow.spec.arguments.parameters.map((param: any) => {
    //             // Check if the param name exists in the replacements object
    //             if (replacements.hasOwnProperty(param.name)) {
    //                 // Update the value if there is a matching key in replacements
    //                 return {
    //                     ...param,
    //                     value: replacements[param.name]
    //                 };
    //             }
    //             return param;
    //         });
    //     }
    //     return updatedWorkflow;
    // }
    /**
     *
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     */
    deploy(ctx, workflowFilePath, workflowName) {
        return __awaiter(this, void 0, void 0, function* () {
            // Run the workflow
            yield this.argoClient.runWorkflow(ctx.logger, workflowFilePath, workflowName);
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
     *
     * @param ctx
     * @param clusterEntity
     * @param dnsEntity
     * @param k8sHost
     * @param workflowFilePath
     */
    prepareWorkflow(ctx, clusterEntity, dnsEntity, k8sHost) {
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
            // const args = this.computeArgumentsFile(clusterEntity, dnsEntity, JSON.parse(ctx.input.cloudCredentials).project_id, ctx);
            // const updatedWorkflowTmp = this.updateWorkflowSpecArguments(workflow, args);
            // const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAmpSecretsWithVault : false;
            // // ArgoCD
            // const argoCdRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmRepo').value;	
            // const argoCdChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmChart').value;
            // const argoCdVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'argoCdHelmVersion').value;
            // // ExternalSecrets
            // const externalSecretsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmRepo').value;	
            // const externalSecretsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmChart').value;
            // const externalSecretsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalSecretsHelmVersion').value;
            // const clusterSecretStoreName = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'vaultAmpClusterSecretStoreName').value;
            // // CertManager
            // const certManagerRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmRepo').value;	
            // const certManagerChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmChart').value;
            // const certManagerVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'certManagerHelmVersion').value;
            // const certManagerRootClusterIssuer = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'rootDomainAmpClusterIssuerName').value;
            // // ExternalDns
            // const externalDnsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmRepo').value;	
            // const externalDnsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmChart').value;
            // const externalDnsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'externalDnsHelmVersion').value;
            // const externalDnsClusterRootDomain = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'clusterRootDomain').value;
            // // Istio
            // const istioGatewayRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmRepo').value;	
            // const istioGatewayChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmChart').value;
            // const istioGatewayVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'istioGatewayHelmVersion').value;
            // // Crossplane
            // const crossplaneRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmRepo').value;	
            // const crossplaneChart = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmChart').value;
            // const crossplaneVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'crossplaneHelmVersion').value;
            // const gcpProviderConfigName = updatedWorkflowTmp.spec.arguments.parameters.find((param: { name: string; }) => param.name === 'gcpProviderConfigName').value;
            // args.uuid = uidGen;
            // args.gitlabCredsSecretName = "backstage-secrets"
            // args.gitlabCredsSecretNamespace = "backstage-system"
            // args.resourceOwnerRef = ctx.input.catalogOwnerRef;
            // args.targetBackstageSystem = ctx.input.targetSystem;
            // args.targetBackstageSystemNormalized = BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
            // args.normalizedName = ctx.input.name;
            // args.backstageSpecOther = yaml.dump({
            //     "data": {
            //         "cloudProvider": dnsEntity.spec.cloudProvider,
            //         "k8sCatalogRef": ctx.input.targetCluster,
            //         "dnsCatalogRef": ctx.input.rootDnsHost,
            //         "kubeApiHost": k8sHost,
            //         "gcpProjectId": clusterEntity.spec.data.projectId,
            //         "oci": {
            //             "ociRepo": clusterEntity.spec.data.ociRepo,
            //             "ociUsername": ctx.input.ociAuthUsername,
            //         },
            //         "vault": {
            //             "vaultNamespace": manageSecretsWithVault ? ctx.input.vaultNamespace : "",
            //             "vaultEnvironment": manageSecretsWithVault ? ctx.input.vaultEnvironment : "",
            //         },
            //         "features": {
            //             "istio": {
            //                 "installed": ctx.input.installIstio,
            //                 "repo": istioGatewayRepo,
            //                 "chart": istioGatewayChart,
            //                 "version": istioGatewayVersion,
            //             },
            //             "externalDns": {
            //                 "installed": ctx.input.installExternalDns,
            //                 "repo": externalDnsRepo,
            //                 "chart": externalDnsChart,
            //                 "version": externalDnsVersion,
            //                 "clusterRootDomain": externalDnsClusterRootDomain
            //             },
            //             "certManager": {
            //                 "installed": ctx.input.installCertManager,
            //                 "repo": certManagerRepo,
            //                 "chart": certManagerChart,
            //                 "version": certManagerVersion,
            //                 "clusterIssuer": certManagerRootClusterIssuer
            //             },
            //             "externalSecrets": {
            //                 "installed": ctx.input.installExternalSecrets,
            //                 "repo": externalSecretsRepo,
            //                 "chart": externalSecretsChart,
            //                 "version": externalSecretsVersion,
            //                 "clusterSecretStoreName": clusterSecretStoreName
            //             },
            //             "argoCd": {
            //                 "installed": ctx.input.installArgocd,
            //                 "repo": argoCdRepo,
            //                 "chart": argoCdChart,
            //                 "version": argoCdVersion,
            //                 "dashboardUrl": `https://argocd.${externalDnsClusterRootDomain}`
            //             },
            //             "crossplane": {
            //                 "installed": true,
            //                 "repo": crossplaneRepo,
            //                 "chart": crossplaneChart,
            //                 "version": crossplaneVersion,
            //                 "gcpProviderConfigName": gcpProviderConfigName
            //             },
            //             "manageAxionSecretsWithVault": manageSecretsWithVault,
            //             "manageWithArgocd": ctx.input.manageWithArgocd ? ctx.input.manageWithArgocd : false,
            //         }
            //     }
            // })
            // const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
            // const workflowName = `axion-proxy-${ctx.input.name}-${uidGen}`
            // updatedWorkflow.metadata.name = workflowName;
            // // Convert the JSON object to YAML format
            // const yamlContent = yaml.dump(updatedWorkflow);
            // uid = new ShortUniqueId({ length: 10 });
            // const workflowFilePath = `./${uid.rnd()}-workflow-proxy.yaml`
            // // Write the YAML content to the specified file
            // await fs.writeFile(workflowFilePath, yamlContent, 'utf-8');
            // return {
            //     uidGen: uidGen,
            //     workflowFilePath: workflowFilePath,
            //     workflowName: workflowName
            // }
        });
    }
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx, dnsEntity) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create the Amp System namespace if it does not exist
            yield this.createAmpSystemNamespace();
            // Prepare the temporary secret for the Amp installation
            yield this.prepareTemporarySecret(ctx.input.cloudCredentials, dnsEntity.spec.cloudProvider, ctx.input.gitlabGroupAuthToken);
        });
    }
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    createWorkflowScriptsConfigMap(ctx, k8sBackstageClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmpFolder = yield fs.mkdtemp(path.join(os.tmpdir(), 'backstage-'));
            try {
                let secretValues = yield k8sBackstageClient.getSecretValues('backstage-system', 'backstage-secrets');
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
                yield k8sBackstageClient.deleteResourceIfExists(`/api/v1/namespaces/argo/configmaps/script-config-map`);
                yield k8sBackstageClient.applyResource(`/api/v1/namespaces/argo/configmaps`, configMap);
            }
            finally {
                yield fs.rmdir(tmpFolder, { recursive: true });
            }
        });
    }
}
exports.AmpController = AmpController;
