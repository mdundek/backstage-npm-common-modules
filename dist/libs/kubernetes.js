"use strict";
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
                throw new Error(`Failed to fetch secret, status: ${response.status}`);
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
                throw new Error(`Failed to fetch resource, status: ${response.status}`);
            }
            // Parse the response as JSON
            return yield response.json();
        });
    }
}
exports.KubernetesClient = KubernetesClient;
