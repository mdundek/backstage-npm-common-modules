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
const kubernetes_1 = require("./kubernetes");
const backstageRegistrar_1 = require("./backstageRegistrar");
const argo_1 = require("./argo");
const gitlab_1 = require("./gitlab");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
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
class AxionController {
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost, k8sSaToken) {
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
            // Create the temporary-axion-credentials secret
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
     * @param repo
     * @param username
     * @param password
     */
    createArgoPullSecret(repo, username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretExists = false;
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-sa-regcreds`);
                secretExists = true;
                // If still standing, we have a secret. Let's delete it first
                yield this.k8sClient.deleteSecret("argo-sa-regcreds", "argo");
            }
            catch (error) {
                if (secretExists) {
                    throw new Error(`Could not delete secret: ${error.message}`);
                }
            }
            yield this.k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
                "apiVersion": "v1",
                "data": {
                    ".dockerconfigjson": btoa(`{"auths":{"${repo}":{"username":"${username}","password":"${password}","email":"DUMMY_DOCKER_EMAIL","auth":"${btoa(`${username}:${password}`)}"}}}`)
                },
                "kind": "Secret",
                "metadata": {
                    "name": "argo-sa-regcreds",
                    "namespace": "argo",
                },
                "type": "kubernetes.io/dockerconfigjson"
            });
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
     *
     * @param vaultToken
     * @param vaultEnvironment
     * @param vaultNamespace
     * @returns
     */
    testVaultCreds(vaultToken, vaultEnvironment, vaultNamespace) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.NODE_ENV == "development") {
                return true;
            }
            let uid = new short_unique_id_1.default({ length: 5 });
            let secretName = `SECRET_SAMPLE_${uid.rnd().toUpperCase()}`;
            try {
                let response = yield fetchProxy(`${vaultEnvironment}/v1/secrets/kv/data/${vaultNamespace}`, {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Vault-Token': vaultToken,
                    },
                    body: `{ "data": { "${secretName}": "sample" } }`
                });
                if (!response.ok) {
                    throw new Error(`Could not access Vault, make sure your token is valid.`);
                }
                response = yield fetchProxy(`https://${vaultEnvironment}.ess.ea.com/v1/secrets/kv/data/${vaultNamespace}/${secretName}`, {
                    method: 'DELETE',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Vault-Token': vaultToken,
                    }
                });
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    /**
     *
     * @param repo
     * @param username
     * @param password
     * @returns
     */
    testOciCreds(repo, username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            let code = yield this.runCommand("docker", ["--version"]);
            if (code != 0) {
                return true;
            }
            return ((yield this.runCommand("echo", [password, "|", "docker", "login", repo, "-u", username, "--password-stdin"])) == 0);
        });
    }
    /**
     *
     * @param jsonKey
     * @returns
     */
    testCloudCreds(jsonKey, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            let code = yield this.runCommand("gcloud", ["--version"]);
            if (code != 0) {
                return true;
            }
            // Create a temporary file
            const tempDir = os.tmpdir();
            const tempKeyFile = path.join(tempDir, `gcp-key-${Date.now()}.json`);
            const tempExecFile = path.join(tempDir, `gcp-key-${Date.now()}.sh`);
            try {
                // Write JSON key content to the temporary file
                yield fs.writeFile(tempKeyFile, jsonKey);
                yield fs.writeFile(tempExecFile, `#!/bin/bash
gcloud auth revoke | true
gcloud auth activate-service-account --key-file ${tempKeyFile}
ACCESS_TOKEN=$(gcloud auth print-access-token)
UNAUTHENTICATED=$(curl -H "Authorization: Bearer $ACCESS_TOKEN" https://cloudresourcemanager.googleapis.com/v1/projects/${projectId} | grep "UNAUTHENTICATED")
if [ ! -z "$UNAUTHENTICATED" ]; then
    exit 1
fi`);
                yield this.runCommand("chmod", ["a+x", tempExecFile]);
                if ((yield this.runCommand(tempExecFile)) != 0) {
                    return false;
                }
                return true;
            }
            catch (error) {
                return false;
            }
            finally {
                // Delete the temporary file
                try {
                    yield fs.unlink(tempKeyFile);
                }
                catch (_) { }
                try {
                    yield fs.unlink(tempExecFile);
                }
                catch (_) { }
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
    runCommand(command_1) {
        return __awaiter(this, arguments, void 0, function* (command, args = []) {
            return new Promise((resolve) => {
                const process = (0, child_process_1.spawn)(command, args);
                process.on('close', (exitCode) => {
                    resolve(exitCode);
                });
            });
        });
    }
    /**
     * validateCredentials
     * @param ctx
     * @param clusterEntity
     * @param nakedRepo
     * @param k8sSaToken
     * @param k8sHost
     */
    validateCredentials(ctx, clusterEntity, nakedRepo, k8sSaToken, k8sHost) {
        return __awaiter(this, void 0, void 0, function* () {
            ctx.logger.info(' => Validating credentials and basic access...');
            const authErrors = [];
            const cloudCredsValid = yield this.testCloudCreds(ctx.input.cloudCredentials, clusterEntity.spec.data.projectId);
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
            yield this.createArgoPullSecret(nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);
            // Create the Workflow Service Account if it does not exist
            yield this.createArgoWorkflowAdminSa();
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
                console.log("----------------------------");
                console.log(b64Buffer);
                console.log(b64Buffer.toString('utf-8'));
                console.log("----------------------------");
                // Parse the YAML content
                // let parsedLocationsYaml = yaml.load(b64Buffer.toString('utf-8')) as any;
                ctx.logger.info(` => Applying template ${templatePath}...`);
                // Apply to remote cluster
                this.k8sClient.applyYaml(b64Buffer.toString('utf-8'));
            }
        });
    }
}
exports.AxionController = AxionController;
