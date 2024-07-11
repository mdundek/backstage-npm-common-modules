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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KubernetesClient = void 0;
const yaml = __importStar(require("js-yaml"));
const KUBE_API_SERVER = process.env.KUBE_API_SERVER;
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN;
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
class KubernetesClient {
    /**
     *
     * @param host
     * @param token
     */
    constructor(host, token) {
        this.KUBE_API_SERVER = host || KUBE_API_SERVER;
        this.SA_TOKEN = token || SA_TOKEN;
    }
    /**
     * deleteResourceIfExists
     * @param path
     */
    deleteResourceIfExists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            let delRresponse = null;
            try {
                yield this.fetchRaw(path);
                // If we are still standing, then this means the resource exists. Delete it now...
                delRresponse = yield fetchProxy(`${this.KUBE_API_SERVER}${path}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.SA_TOKEN}`
                    }
                });
                if (!delRresponse.ok) {
                    const errorText = yield delRresponse.text();
                    throw new Error(`Failed to apply workflow: ${errorText}`);
                }
            }
            catch (error) {
                if (delRresponse) {
                    console.log(error);
                    throw error;
                }
            }
        });
    }
    /**
     * applyResource
     * @param path
     * @param body
     * @returns
     */
    applyResource(path, body, ignoreAlreadyExistError) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetchProxy(`${this.KUBE_API_SERVER}${path}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.SA_TOKEN}`
                    },
                    body: JSON.stringify(body)
                });
                if (!response.ok) {
                    if (ignoreAlreadyExistError && response.status != 409) {
                        const errorText = yield response.text();
                        throw new Error(`Failed to apply workflow: ${errorText}`);
                    }
                    return;
                }
                return yield response.json();
            }
            catch (error) {
                console.log(error);
                throw error;
            }
        });
    }
    /**
     *
     * @param secretName
     * @param namespace
     * @returns
     */
    fetchSecret(secretName, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
            return yield fetchProxy(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                }
            });
        });
    }
    /**
     *
     * @param secretName
     * @param namespace
     * @returns
     */
    deleteSecret(secretName, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
            return yield fetchProxy(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                }
            });
        });
    }
    /**
     *
     * @param namespace
     * @param secretName
     * @returns
     */
    getSecretValues(namespace, secretName) {
        return __awaiter(this, void 0, void 0, function* () {
            // Define the API server URL. Adjust if necessary.
            const apiUrl = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
            // Make the request to the Kubernetes API
            const response = yield fetchProxy(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.SA_TOKEN}`, // Assumes the token is available as an environment variable
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                throw new Error(`Failed to fetch secret, status: ${response.statusText}`);
            }
            // Parse the response as JSON
            const data = yield response.json();
            const secretData = {};
            Object.keys(data.data).forEach((key) => {
                const base64Value = data.data[key];
                const decodedValue = Buffer.from(base64Value, 'base64').toString('utf-8');
                secretData[key] = decodedValue;
            });
            return secretData;
        });
    }
    /**
     * fetchRaw
     * @param path
     * @returns
     */
    fetchRaw(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.KUBE_API_SERVER}${path}`;
            const response = yield fetchProxy(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                }
            });
            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                throw new Error(`Failed to fetch resource, status: ${response.statusText}`);
            }
            // Parse the response as JSON
            return yield response.json();
        });
    }
    /**
     * namespaceExists
     * @param namespace
     * @returns
     */
    namespaceExists(namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetchProxy(`${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                },
            });
            if (response.status === 200) {
                return true;
            }
            else if (response.status === 404) {
                return false;
            }
            else {
                throw new Error(`Failed to lookup namespace, status: ${response.statusText}`);
            }
        });
    }
    /**
     * createNamespace
     * @param namespace
     */
    createNamespace(namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.applyResource(`/api/v1/namespaces`, {
                apiVersion: "v1",
                kind: "Namespace",
                metadata: {
                    name: namespace,
                },
            });
            // Check if the response is ok (status code 200-299)
            if (!response.ok) {
                throw new Error(`Failed to create namespace, status: ${response.statusText}`);
            }
        });
    }
    /**
     *
     * @param name
     * @param namespace
     * @returns
     */
    hasDeployment(name, namespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetchProxy(`${this.KUBE_API_SERVER}/apis/apps/v1/namespaces/${namespace}/deployments/${name}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                },
            });
            if (response.status === 200) {
                return true;
            }
            else if (response.status === 404) {
                return false;
            }
            else {
                throw new Error(`Failed to lookup deployment, status: ${response.statusText}`);
            }
        });
    }
    /**
     *
     * @param yamlLocalionUrl
     * @param targetNamespace
     */
    deployRemoteYaml(yamlLocalionUrl, targetNamespace) {
        return __awaiter(this, void 0, void 0, function* () {
            // Fetch the YAML content from the URL
            const response = yield fetch(yamlLocalionUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch YAML: ${response.statusText}`);
            }
            const yamlContent = yield response.text();
            // Parse the YAML content
            yield this.applyYaml(yamlContent, targetNamespace);
        });
    }
    /**
     *
     * @param yamlContent
     * @param targetNamespace
     */
    applyYaml(yamlContent, targetNamespace) {
        return __awaiter(this, void 0, void 0, function* () {
            const clusterScopedKinds = new Set([
                'Namespace', 'Node', 'PersistentVolume', 'CustomResourceDefinition',
                'ClusterRole', 'ClusterRoleBinding', 'ValidatingWebhookConfiguration',
                'MutatingWebhookConfiguration', 'APIService', 'PriorityClass',
                'ClusterIssuer', 'ClusterSecretStore', 'ClusterExternalSecret', 'ClusterWorkflowTemplate'
            ]);
            // Parse the YAML content
            const resources = yaml.loadAll(yamlContent);
            if (!resources || resources.length === 0) {
                throw new Error('No resources found in YAML content.');
            }
            // Apply each resource to the Kubernetes API
            for (const resource of resources) {
                if (resource) {
                    const { kind, apiVersion } = resource;
                    let apiPath = '';
                    const apiKindLower = kind.toLowerCase();
                    if (clusterScopedKinds.has(kind)) {
                        // Cluster-scoped resource
                        if (apiVersion.startsWith('v1')) {
                            apiPath = `/api/v1/${apiKindLower}${apiKindLower.endsWith("ss") ? "es" : "s"}`;
                        }
                        else {
                            const [group, version] = apiVersion.split('/');
                            apiPath = `/apis/${group}/${version}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es" : "s"}`;
                        }
                    }
                    else if (targetNamespace) {
                        // Namespace-scoped resource
                        if (apiVersion.startsWith('v1')) {
                            apiPath = `/api/v1/namespaces/${targetNamespace}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es" : "s"}`;
                        }
                        else {
                            const [group, version] = apiVersion.split('/');
                            apiPath = `/apis/${group}/${version}/namespaces/${targetNamespace}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es" : "s"}`;
                        }
                    }
                    else {
                        throw new Error(`Resource kind ${kind} is not supported in cluster-scoped mode.`);
                    }
                    yield this.deleteResourceIfExists(`${apiPath}/${resource.metadata.name}`);
                    yield this.applyResource(apiPath, resource, false);
                }
            }
        });
    }
}
exports.KubernetesClient = KubernetesClient;
