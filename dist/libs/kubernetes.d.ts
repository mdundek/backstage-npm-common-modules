declare class KubernetesClient {
    private KUBE_API_SERVER?;
    private SA_TOKEN?;
    /**
     *
     * @param host
     * @param token
     */
    constructor(host?: string, token?: string);
    /**
     * deleteResourceIfExists
     * @param path
     */
    deleteResourceIfExists(path: string): Promise<void>;
    /**
     * applyResource
     * @param path
     * @param body
     * @returns
     */
    applyResource(path: string, body: any, ignoreAlreadyExistError?: boolean): Promise<any>;
    /**
     *
     * @param secretName
     * @param namespace
     * @returns
     */
    fetchSecret(secretName: string, namespace: string): Promise<Response>;
    /**
     *
     * @param secretName
     * @param namespace
     * @returns
     */
    deleteSecret(secretName: string, namespace: string): Promise<Response>;
    /**
     *
     * @param namespace
     * @param secretName
     * @returns
     */
    getSecretValues(namespace: string, secretName: string): Promise<{
        [key: string]: string;
    }>;
    /**
     * fetchRaw
     * @param path
     * @returns
     */
    fetchRaw(path: string): Promise<any>;
    /**
     * namespaceExists
     * @param namespace
     * @returns
     */
    namespaceExists(namespace: string): Promise<boolean>;
    /**
     * createNamespace
     * @param namespace
     */
    createNamespace(namespace: string): Promise<void>;
    /**
     *
     * @param name
     * @param namespace
     * @returns
     */
    hasDeployment(name: string, namespace: string): Promise<boolean>;
    /**
     *
     * @param yamlLocalionUrl
     * @param targetNamespace
     */
    deployRemoteYaml(yamlLocalionUrl: string, targetNamespace: string): Promise<void>;
    /**
     *
     * @param yamlContent
     * @param targetNamespace
     */
    applyYaml(yamlContent: string, targetNamespace?: string): Promise<void>;
}
export { KubernetesClient };
//# sourceMappingURL=kubernetes.d.ts.map