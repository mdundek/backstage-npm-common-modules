declare class ArgoClient {
    private KUBE_API_SERVER?;
    private SA_TOKEN?;
    /**
     *
     * @param host
     * @param token
     */
    constructor(host?: string, token?: string);
    /**
     *
     * @param filePath
     * @param isAxionRepo
     * @param branchName
     */
    fetchWorkflowFromWorkflowRepo(filePath: string, isAxionRepo?: boolean, branchName?: string): Promise<any>;
    /**
     *
     * @param logger
     * @param workflowFilePath
     * @param workflowName
     */
    runWorkflow(logger: any, workflowFilePath: string, workflowName: string, proxied?: boolean, debug?: boolean): Promise<any>;
    /**
     *
     * @param workflowName
     */
    fetchWorkflowStatus(workflowName: string): Promise<any>;
}
export { ArgoClient };
//# sourceMappingURL=argo.d.ts.map