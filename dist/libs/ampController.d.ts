import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { ArgoClient } from './argo';
declare class AmpController extends ControllerBase {
    k8sClient: KubernetesClient;
    argoClient: ArgoClient;
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost?: string, k8sSaToken?: string);
    /**
     public computeArgumentsFile
     * @param ampGitlabGroupId
     * @param projectTitleName
     * @param projectDnsName
     * @param teamMailingListEmail
     * @param devDnsRootDomain
     * @param intDnsRootDomain
     * @param ampDataGitRepoUrl
     * @param ampCodeGitRepoUrl
     * @param targetDevCertManagerIssuerName
     * @param targetDevCertManagerRootCertName
     * @param targetIntCertManagerIssuerName
     * @param targetIntCertManagerRootCertName
     * @param oauthClientId
     * @param terraformCleanupBeforeCreate
     * @returns
     */
    computeArgumentsFile(ampGitlabGroupId: string, projectTitleName: string, projectDnsName: string, teamMailingListEmail: string, devDnsRootDomain: string, intDnsRootDomain: string, ampDataGitRepoUrl: string, ampCodeGitRepoUrl: string, targetDevCertManagerIssuerName: string, targetDevCertManagerRootCertName: string, targetIntCertManagerIssuerName: string, targetIntCertManagerRootCertName: string, oauthClientId: string, terraformCleanupBeforeCreate: boolean, tempSecretName: string): any;
    /**
     *
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     */
    deploy(ctx: any, workflowFilePath: string, workflowName: string, debug?: boolean): Promise<void>;
    /**
     *
     */
    createAmpSystemNamespace(): Promise<void>;
    /**
     * prepareWorkflow
     * @param ctx
     * @param devDnsRootDomain
     * @param intDnsRootDomain
     * @param targetDevCertManagerIssuerName
     * @param targetDevCertManagerRootCertName
     * @param targetIntCertManagerIssuerName
     * @param targetIntCertManagerRootCertName
     * @param ampDataGitRepoUrl
     * @param ampCodeGitRepoUrl
     * @returns
     */
    prepareWorkflow(ctx: any, masterConfigJson: any, devDnsRootDomain: string, intDnsRootDomain: string, targetDevCertManagerIssuerName: string, targetDevCertManagerRootCertName: string, targetIntCertManagerIssuerName: string, targetIntCertManagerRootCertName: string, ampDataGitRepoUrl: string, ampCodeGitRepoUrl: string): Promise<{
        uidGen: string;
        workflowFilePath: string;
        workflowName: string;
    }>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx: any, cloudProvider: string, gcpRegion: string, uidGen: string): Promise<{
        tmpCredsSecretName: string;
    }>;
}
export { AmpController };
//# sourceMappingURL=ampController.d.ts.map