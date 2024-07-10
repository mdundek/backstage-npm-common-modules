import * as yaml from 'js-yaml';

const KUBE_API_SERVER = process.env.KUBE_API_SERVER;
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN;

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

class KubernetesClient {
    private KUBE_API_SERVER?: string;
    private SA_TOKEN?: string;

    /**
     * 
     * @param host 
     * @param token 
     */
    constructor(host?: string, token?: string) {
        this.KUBE_API_SERVER = host || KUBE_API_SERVER;
        this.SA_TOKEN = token || SA_TOKEN;
    }

    /**
     * deleteResourceIfExists
     * @param path 
     */
    public async deleteResourceIfExists(path: string) {
        let delRresponse = null;
        try {
            await this.fetchRaw(path)
            // If we are still standing, then this means the resource exists. Delete it now...
            delRresponse = await fetchProxy(`${this.KUBE_API_SERVER}${path}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                }
            });
    
            if (!delRresponse.ok) {
                const errorText = await delRresponse.text();
                throw new Error(`Failed to apply workflow: ${errorText}`);
            }
        } catch (error) {
            if(delRresponse) {
                console.log(error)
                throw error
            }
        }
    }

    /**
     * applyResource
     * @param path 
     * @param body 
     * @returns 
     */
    public async applyResource(path: string, body: any, ignoreAlreadyExistError?: boolean) {
        try {
            const response = await fetchProxy(`${this.KUBE_API_SERVER}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.SA_TOKEN}`
                },
                body: JSON.stringify(body)
            });
    
            if (!response.ok) {
                if(ignoreAlreadyExistError && response.status != 409) {
                    const errorText = await response.text();
                    throw new Error(`Failed to apply workflow: ${errorText}`);
                }
                return;
            }
            return await response.json();
        } catch (error) {
            console.log(error)
            throw error
        }
    }

    /**
     * 
     * @param secretName 
     * @param namespace 
     * @returns 
     */
    public async fetchSecret(secretName: string, namespace: string) {
        const url = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
        return await fetchProxy(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.SA_TOKEN}`
            }
        });
    }

    /**
     * 
     * @param secretName 
     * @param namespace 
     * @returns 
     */
    public async deleteSecret(secretName: string, namespace: string) {
        const url = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
        return await fetchProxy(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.SA_TOKEN}`
            }
        });
    }

    /**
     * 
     * @param namespace 
     * @param secretName 
     * @returns 
     */
    public async getSecretValues(namespace: string, secretName: string) {
        // Define the API server URL. Adjust if necessary.
        const apiUrl = `${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}/secrets/${secretName}`;

        // Make the request to the Kubernetes API
        const response = await fetchProxy(apiUrl, { 
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
        const data:any = await response.json();

        const secretData: { [key: string]: string } = {};
        Object.keys(data.data).forEach((key: string) => {
            const base64Value = data.data[key];
            const decodedValue = Buffer.from(base64Value, 'base64').toString('utf-8');
            secretData[key] = decodedValue;
        });
        return secretData;
    }

    /**
     * fetchRaw
     * @param path 
     * @returns 
     */
    public async fetchRaw(path: string) {
        const url = `${this.KUBE_API_SERVER}${path}`;
        const response = await fetchProxy(url, {
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
        return await response.json();
    }

    /**
     * namespaceExists
     * @param namespace 
     * @returns 
     */
    public async namespaceExists(namespace: string) {
        console.log("====> 1")
        const response = await fetchProxy(`${this.KUBE_API_SERVER}/api/v1/namespaces/${namespace}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.SA_TOKEN}`
            },
        });
        console.log(response);
        if (response.status === 200) {
            return true;
        } else if (response.status === 404) {
            return false;
        } else {
            throw new Error(`Failed to lookup namespace, status: ${response.status}`);
        }
    }

    /**
     * createNamespace
     * @param namespace 
     */
    public async createNamespace(namespace: string) {
        console.log("====> 2")
        const response:any = await this.applyResource(`${this.KUBE_API_SERVER}/api/v1/namespaces`, {
            apiVersion: "v1",
            kind: "Namespace",
            metadata: {
              name: namespace,
            },
        })
        console.log(response);
        // Check if the response is ok (status code 200-299)
        if (!response.ok) {
            throw new Error(`Failed to create namespace, status: ${response.status}`);
        }
    }

    /**
     * 
     * @param name 
     * @param namespace 
     * @returns 
     */
    public async hasDeployment(name: string, namespace: string) {
        console.log("====> 3")
        const response = await fetchProxy(`${this.KUBE_API_SERVER}/apis/apps/v1/namespaces/${namespace}/deployments/${name}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.SA_TOKEN}`
            },
        });
        console.log(response);
        if (response.status === 200) {
            return true;
        } else if (response.status === 404) {
            return false;
        } else {
            throw new Error(`Failed to lookup deployment, status: ${response.status}`);
        }
    }

    /**
     * 
     * @param yamlLocalionUrl 
     * @param targetNamespace 
     */
    public async deployRemoteYaml(
        yamlLocalionUrl: string, 
        targetNamespace: string
    ) {
        console.log("====> 4")
        // Fetch the YAML content from the URL
        const response = await fetch(yamlLocalionUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch YAML: ${response.statusText}`);
        }

        console.log(response);
        const yamlContent = await response.text();
    
        // Parse the YAML content
        await this.applyYaml(yamlContent, targetNamespace)
    }

    /**
     * 
     * @param yamlContent 
     * @param targetNamespace 
     */
    public async applyYaml(
        yamlContent: string, 
        targetNamespace?: string
    ) {
        const clusterScopedKinds = new Set([
            'Namespace', 'Node', 'PersistentVolume', 'CustomResourceDefinition',
            'ClusterRole', 'ClusterRoleBinding', 'ValidatingWebhookConfiguration',
            'MutatingWebhookConfiguration', 'APIService', 'PriorityClass', 
            'ClusterIssuer', 'ClusterSecretStore', 'ClusterExternalSecret', 'ClusterWorkflowTemplate'
        ]);

        // Parse the YAML content
        const resources: any = yaml.loadAll(yamlContent);
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
                        apiPath = `/api/v1/${apiKindLower}${apiKindLower.endsWith("ss") ? "es":"s"}`;
                    } else {
                        const [group, version] = apiVersion.split('/');
                        apiPath = `/apis/${group}/${version}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es":"s"}`;
                    }
                } else if (targetNamespace){
                    // Namespace-scoped resource
                    if (apiVersion.startsWith('v1')) {
                        apiPath = `/api/v1/namespaces/${targetNamespace}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es":"s"}`;
                    } else {
                        const [group, version] = apiVersion.split('/');
                        apiPath = `/apis/${group}/${version}/namespaces/${targetNamespace}/${apiKindLower}${apiKindLower.endsWith("ss") ? "es":"s"}`;
                    }
                } else {
                    throw new Error(`Resource kind ${kind} is not supported in cluster-scoped mode.`);
                }
                await this.deleteResourceIfExists(`${apiPath}/${resource.metadata.name}`)
                await this.applyResource(apiPath, resource, false)
            }
        }
    }
}

export { KubernetesClient };