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
exports.ControllerBase = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const gitlab_1 = require("./gitlab");
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
class ControllerBase {
    constructor() { }
    /**
     * createAwsProviderConfigSecret
     * @param k8sClient
     * @param secretName
     * @param namespace
     * @param aws_access_key_id
     * @param aws_secret_access_key
     */
    createAwsProviderConfigSecret(k8sClient, secretName, namespace, aws_access_key_id, aws_secret_access_key) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sure we remove secret if it exists first
            try {
                yield k8sClient.fetchSecret(secretName, namespace);
                yield k8sClient.deleteSecret(secretName, namespace);
            }
            catch (_) { }
            const base64KeyData = Buffer.from(`[default]
aws_access_key_id = ${aws_access_key_id}
aws_secret_access_key = ${aws_secret_access_key}`).toString('base64');
            // Create the temporary secret
            yield k8sClient.applyResource(`/api/v1/namespaces/${namespace}/secrets`, {
                apiVersion: "v1",
                data: {
                    "credentials": base64KeyData
                },
                kind: "Secret",
                metadata: {
                    name: secretName
                },
                type: "Opaque"
            });
        });
    }
    /**
     * createGcpProviderConfigSecret
     * @param k8sClient
     * @param secretName
     * @param namespace
     * @param jsonKey
     */
    createGcpProviderConfigSecret(k8sClient, secretName, namespace, jsonKey) {
        return __awaiter(this, void 0, void 0, function* () {
            // Make sure we remove secret if it exists first
            try {
                yield k8sClient.fetchSecret(secretName, namespace);
                yield k8sClient.deleteSecret(secretName, namespace);
            }
            catch (_) { }
            const base64KeyData = Buffer.from(jsonKey).toString('base64');
            // Create temporary secret
            yield k8sClient.applyResource(`/api/v1/namespaces/${namespace}/secrets`, {
                apiVersion: "v1",
                data: {
                    "credentials": base64KeyData
                },
                kind: "Secret",
                metadata: {
                    name: secretName
                },
                type: "Opaque"
            });
        });
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
     * createArgoWorkflowAdminSa
     * @param k8sClient
     */
    createArgoWorkflowAdminSa(k8sClient) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield k8sClient.fetchRaw(`/api/v1/namespaces/argo/serviceaccounts/argo-admin`);
            }
            catch (error) {
                // Does not exist, create SA
                yield k8sClient.applyResource(`/api/v1/namespaces/argo/serviceaccounts`, {
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
                yield k8sClient.fetchRaw(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/argo-admin-binding`);
            }
            catch (error) {
                yield k8sClient.applyResource(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings`, {
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
                yield k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-admin`);
            }
            catch (error) {
                // Does not exist, create SA
                yield k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
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
     * createArgoPullSecret
     * @param k8sClient
     * @param repo
     * @param username
     * @param password
     */
    createArgoPullSecret(k8sClient, repo, username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretExists = false;
            try {
                yield k8sClient.fetchRaw(`/api/v1/namespaces/argo/secrets/argo-sa-regcreds`);
                secretExists = true;
                // If still standing, we have a secret. Let's delete it first
                yield k8sClient.deleteSecret("argo-sa-regcreds", "argo");
            }
            catch (error) {
                if (secretExists) {
                    throw new Error(`Could not delete secret: ${error.message}`);
                }
            }
            yield k8sClient.applyResource(`/api/v1/namespaces/argo/secrets`, {
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
     * testGcpCloudCreds
     * @param jsonKey
     * @returns
     */
    testGcpCloudCreds(jsonKey) {
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
UNAUTHENTICATED=$(curl -H "Authorization: Bearer $ACCESS_TOKEN" https://cloudresourcemanager.googleapis.com/v1/projects/${JSON.parse(jsonKey).project_id} | grep "UNAUTHENTICATED")
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
     * ensureArgoIsInstalled
     * @param ctx
     * @param k8sClient
     */
    ensureArgoIsInstalled(ctx, k8sClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const argoNsExists = yield k8sClient.namespaceExists("argo");
            if (!argoNsExists) {
                yield k8sClient.createNamespace("argo");
            }
            const argoDeploymentExists = yield k8sClient.hasDeployment("argo-server", "argo");
            if (!argoDeploymentExists) {
                ctx.logger.info(' => Installing Argo Workflow on target cluster...');
                yield k8sClient.deployRemoteYaml("https://github.com/argoproj/argo-workflows/releases/download/v3.5.7/quick-start-minimal.yaml", "argo");
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
    deployBackstageWorkflowTemplates(ctx, k8sClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretValues = yield k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
            const workflowsRepoProjectId = secretValues.GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID;
            const branchOrTag = 'main';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
            const templateFiles = yield gitlab_1.gitlab.getFilesFromFolder(workflowsRepoProjectId, "templates", branchOrTag, personalAccessToken);
            for (let templatePath of templateFiles) {
                const templateYaml = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, templatePath, branchOrTag, personalAccessToken);
                const b64Buffer = Buffer.from(templateYaml.content, 'base64');
                // Parse the YAML content
                ctx.logger.info(` => Applying template ${templatePath}...`);
                // Apply to remote cluster
                yield k8sClient.applyYaml(b64Buffer.toString('utf-8'));
            }
        });
    }
    /**
     *
     * @param ctx
     */
    deployBackstageCommonWorkflowTemplate(ctx, k8sClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let secretValues = yield k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
            const workflowsRepoProjectId = secretValues.GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID;
            const branchOrTag = 'main';
            const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
            const templateYaml = yield gitlab_1.gitlab.fetchFile(workflowsRepoProjectId, "templates/backstage-common.yaml", branchOrTag, personalAccessToken);
            const b64Buffer = Buffer.from(templateYaml.content, 'base64');
            // Parse the YAML content
            ctx.logger.info(` => Applying template backstage-common.yaml...`);
            // Apply to remote cluster
            yield k8sClient.applyYaml(b64Buffer.toString('utf-8'));
        });
    }
    /**
     * createWorkflowScriptsConfigMap
     * @param ctx
     * @param k8sClient
     */
    createWorkflowScriptsConfigMap(ctx, k8sClient) {
        return __awaiter(this, void 0, void 0, function* () {
            const tmpFolder = yield fs.mkdtemp(path.join(os.tmpdir(), 'backstage-'));
            try {
                ctx.logger.info(' => Fetching scripts from the workflows repository...');
                let secretValues = yield k8sClient.getSecretValues('backstage-system', 'backstage-secrets');
                const workflowsRepoProjectId = secretValues["GITLAB_BACKSTAGE_WORKFLOWS_REPO_ID"];
                const branchOrTag = 'main';
                const personalAccessToken = secretValues.GITLAB_GROUP_BACKSTAGE_RW_TOKEN;
                let scriptsFiles = yield gitlab_1.gitlab.getFilesFromFolder(workflowsRepoProjectId, "amp/scripts", branchOrTag, personalAccessToken);
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
                yield k8sClient.deleteResourceIfExists(`/api/v1/namespaces/argo/configmaps/script-config-map`);
                yield k8sClient.applyResource(`/api/v1/namespaces/argo/configmaps`, configMap);
            }
            finally {
                yield fs.rm(tmpFolder, { recursive: true });
            }
        });
    }
}
exports.ControllerBase = ControllerBase;
