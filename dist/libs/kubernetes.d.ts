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
    deployRemoteYaml(yamlLocalionUrl: string, targetNamespace: string): Promise<void>;
}
export { KubernetesClient };
//# sourceMappingURL=kubernetes.d.ts.map