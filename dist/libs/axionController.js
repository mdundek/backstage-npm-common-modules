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
const argo_1 = require("./argo");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
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
}
exports.AxionController = AxionController;
