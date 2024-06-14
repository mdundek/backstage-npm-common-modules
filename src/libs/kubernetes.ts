
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
        const data = await response.json();

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
}

export { KubernetesClient };