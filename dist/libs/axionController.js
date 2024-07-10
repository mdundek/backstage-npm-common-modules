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
exports.AxionController = void 0;
const controllerBase_1 = require("./controllerBase");
const kubernetes_1 = require("./kubernetes");
const backstageRegistrar_1 = require("./backstageRegistrar");
const argo_1 = require("./argo");
const gitlab_1 = require("./gitlab");
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
class AxionController extends controllerBase_1.ControllerBase {
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost, k8sSaToken) {
        super();
        this.k8sClient = new kubernetes_1.KubernetesClient(k8sHost, k8sSaToken);
        this.argoClient = new argo_1.ArgoClient(k8sHost, k8sSaToken);
    }
    /**
     *
     * @param cloudCredentials
     * @param cloudProvider
     * @param ociAuthToken
     * @param vaultTemporaryToken
     */
    prepareTemporarySecret(cloudCredentials, cloudProvider, ociAuthUsername, ociAuthToken, vaultTemporaryToken) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sure we remove secret if it exists first
            try {
                yield this.k8sClient.fetchSecret("temporary-axion-credentials", "axion-system");
                yield this.k8sClient.deleteSecret("temporary-axion-credentials", "axion-system");
            }
            catch (_) { }
            // Create temporary secret
            yield this.k8sClient.applyResource(`/api/v1/namespaces/axion-system/secrets`, {
                apiVersion: "v1",
                data: {
                    "TARGET_CLOUD": Buffer.from(cloudProvider).toString('base64'),
                    "GCP_REGION": Buffer.from("us-west1").toString('base64'),
                    "GCP_JSON_KEY": Buffer.from(cloudCredentials).toString('base64'),
                    "AXION_OCI_REGISTRY_USERNAME": Buffer.from(ociAuthUsername).toString('base64'),
                    "AXION_OCI_REGISTRY_PASSWORD": Buffer.from(ociAuthToken).toString('base64'),
                    "VAULT_SA_TEMP_TOKEN": vaultTemporaryToken ? Buffer.from(vaultTemporaryToken).toString('base64') : ""
                },
                kind: "Secret",
                metadata: {
                    name: "temporary-axion-credentials"
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
    computeArgumentsFile(clusterEntity, dnsEntity, gcpProjectId, ctx) {
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
        return args;
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
    createAxionSystemNamespace() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/axion-system`);
            }
            catch (error) {
                // Does not exist, create SA
                yield this.k8sClient.applyResource(`/api/v1/namespaces`, {
                    "apiVersion": "v1",
                    "kind": "Namespace",
                    "metadata": {
                        "name": "axion-system"
                    }
                });
            }
        });
    }
    /**
     * validateCredentials
     * @param ctx
     * @param nakedRepo
     * @param k8sSaToken
     * @param k8sHost
     */
    validateCredentials(ctx, nakedRepo, k8sSaToken, k8sHost) {
        return __awaiter(this, void 0, void 0, function* () {
            ctx.logger.info(' => Validating credentials and basic access...');
            const authErrors = [];
            const cloudCredsValid = yield this.testGcpCloudCreds(ctx.input.cloudCredentials);
            const ociCredsValid = yield this.testOciCreds(nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);
            if (ctx.input.manageAxionSecretsWithVault) {
                const vaultCredsValid = yield this.testVaultCreds(ctx.input.vaultTemporaryToken, ctx.input.vaultEnvironment, ctx.input.vaultNamespace);
                if (!vaultCredsValid) {
                    authErrors.push("- Your Vault credentials are invalid");
                }
            }
            const checkKubeapi = yield this.testKubeToken(k8sSaToken, k8sHost);
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
        });
    }
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
            // Fetch the Axion workflow from the Axion workflow repository
            // NOTE: We do not use the target cluster to initiate this here because
            //       it queires the backstage Kube API to get the gitlab credentials,
            //       those are located on this cluster
            ctx.logger.info(' => Fetching Axion workflow from the Axion workflow repository...');
            const workflow = yield new argo_1.ArgoClient().fetchWorkflowFromWorkflowRepo('axion/axion-install-proxy.yaml');
            // Compute the arguments for the Axion installation
            ctx.logger.info(' => Preparing for Axion installation...');
            // Update the workflow with the computed arguments
            const args = this.computeArgumentsFile(clusterEntity, dnsEntity, JSON.parse(ctx.input.cloudCredentials).project_id, ctx);
            const updatedWorkflowTmp = this.updateWorkflowSpecArguments(workflow, args);
            const manageSecretsWithVault = ctx.input.installExternalSecrets ? ctx.input.manageAxionSecretsWithVault : false;
            // ArgoCD
            const argoCdRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'argoCdHelmRepo').value;
            const argoCdChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'argoCdHelmChart').value;
            const argoCdVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'argoCdHelmVersion').value;
            // ExternalSecrets
            const externalSecretsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalSecretsHelmRepo').value;
            const externalSecretsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalSecretsHelmChart').value;
            const externalSecretsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalSecretsHelmVersion').value;
            const clusterSecretStoreName = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'vaultAxionClusterSecretStoreName').value;
            // CertManager
            const certManagerRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'certManagerHelmRepo').value;
            const certManagerChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'certManagerHelmChart').value;
            const certManagerVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'certManagerHelmVersion').value;
            const certManagerRootClusterIssuer = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'rootDomainAxionClusterIssuerName').value;
            const createRootDomainDefaultCertificate = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'createRootDomainDefaultCertificate').value;
            const rootDomainDefaultCertificateName = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'rootDomainDefaultCertificateName').value;
            // ExternalDns
            const externalDnsRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalDnsHelmRepo').value;
            const externalDnsChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalDnsHelmChart').value;
            const externalDnsVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'externalDnsHelmVersion').value;
            const externalDnsClusterRootDomain = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'clusterRootDomain').value;
            // Istio
            const istioGatewayRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'istioGatewayHelmRepo').value;
            const istioGatewayChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'istioGatewayHelmChart').value;
            const istioGatewayVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'istioGatewayHelmVersion').value;
            // Crossplane
            const crossplaneRepo = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'crossplaneHelmRepo').value;
            const crossplaneChart = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'crossplaneHelmChart').value;
            const crossplaneVersion = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'crossplaneHelmVersion').value;
            const gcpProviderConfigName = updatedWorkflowTmp.spec.arguments.parameters.find((param) => param.name === 'gcpProviderConfigName').value;
            args.uuid = uidGen;
            args.gitlabCredsSecretName = "backstage-secrets";
            args.gitlabCredsSecretNamespace = "backstage-system";
            args.resourceOwnerRef = ctx.input.catalogOwnerRef;
            args.targetBackstageSystem = ctx.input.targetSystem;
            args.targetBackstageSystemNormalized = backstageRegistrar_1.BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
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
            });
            const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
            const workflowName = `axion-proxy-${ctx.input.name}-${uidGen}`;
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
     * @param nakedRepo
     * @param k8sSaToken
     * @param k8sHost
     * @param uidGen
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx, dnsEntity, nakedRepo, k8sSaToken, k8sHost, uidGen) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create the Axion System namespace if it does not exist
            yield this.createAxionSystemNamespace();
            // Prepare the temporary secret for the Axion installation
            yield this.prepareTemporarySecret(ctx.input.cloudCredentials, dnsEntity.spec.cloudProvider, ctx.input.ociAuthUsername, ctx.input.ociAuthToken, ctx.input.vaultTemporaryToken);
            // Create the Argo Pull Secret if it does not exist
            yield this.createArgoPullSecret(this.k8sClient, nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);
            // Create the Workflow Service Account if it does not exist
            yield this.createArgoWorkflowAdminSa(this.k8sClient);
            // Create temporary secret with target cluster creds that the proxy workflow can use to deploy the workflow to
            const k8sClient = new kubernetes_1.KubernetesClient();
            yield k8sClient.applyResource(`/api/v1/namespaces/backstage-system/secrets`, {
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
            });
            return {
                tmpCredsSecretName: `tmp-${uidGen}`
            };
        });
    }
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    deployAxionWorkflowTemplates(ctx, k8sBackstageClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretValues = yield k8sBackstageClient.getSecretValues('backstage-system', 'backstage-secrets');
            const workflowsRepoProjectId = secretValues["GITLAB_AXION_WORKFLOWS_REPO_ID"];
            const branchOrTag = 'dev';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
            const templateFiles = yield gitlab_1.gitlab.getFilesFromFolder(workflowsRepoProjectId, "axion-argo-workflow/releases/latest/workflow/templates", branchOrTag, personalAccessToken);
            for (let templatePath of templateFiles) {
                const templateYaml = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, templatePath, branchOrTag, personalAccessToken);
                const b64Buffer = Buffer.from(templateYaml.content, 'base64');
                // Parse the YAML content
                ctx.logger.info(` => Applying template ${templatePath}...`);
                // Apply to remote cluster
                yield this.k8sClient.applyYaml(b64Buffer.toString('utf-8'));
            }
        });
    }
}
exports.AxionController = AxionController;
