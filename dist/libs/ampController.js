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
exports.AmpController = void 0;
const controllerBase_1 = require("./controllerBase");
const kubernetes_1 = require("./kubernetes");
const backstageRegistrar_1 = require("./backstageRegistrar");
const argo_1 = require("./argo");
const path = __importStar(require("path"));
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';
class AmpController extends controllerBase_1.ControllerBase {
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost, k8sSaToken) {
        super();
        this.k8sClient = new kubernetes_1.KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
        this.argoClient = new argo_1.ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
    }
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
    computeArgumentsFile(ampGitlabGroupId, projectTitleName, projectDnsName, teamMailingListEmail, devDnsRootDomain, intDnsRootDomain, ampDataGitRepoUrl, ampCodeGitRepoUrl, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, oauthClientId, terraformCleanupBeforeCreate, tempSecretName) {
        // Prepare the Argo Workflow arguments for the Axion installation
        const args = {
            "ampGitlabGroupId": ampGitlabGroupId,
            "projectTitleName": projectTitleName,
            "projectDnsName": projectDnsName,
            "teamMailingListEmail": teamMailingListEmail,
            "devDnsRootDomain": devDnsRootDomain,
            "intDnsRootDomain": intDnsRootDomain,
            "ampDataGitRepoUrl": ampDataGitRepoUrl,
            "ampCodeGitRepoUrl": ampCodeGitRepoUrl,
            "targetDevCertManagerIssuerName": targetDevCertManagerIssuerName,
            "targetDevCertManagerRootCertName": targetDevCertManagerRootCertName,
            "targetIntCertManagerIssuerName": targetIntCertManagerIssuerName,
            "targetIntCertManagerRootCertName": targetIntCertManagerRootCertName,
            "oauthClientId": oauthClientId,
            "terraformCleanupBeforeCreate": terraformCleanupBeforeCreate,
            "tempSecretName": tempSecretName,
            "tempSecretNamespace": "amp-system",
            "tempSecretGitlabTokenField": "GITLAB_TOKEN",
            "tempSecretGcpJsonKeyField": "GCP_JSON_KEY",
            "tempSecretGcpRegionField": "GCP_REGION",
            "terraformOutputSecretName": "terraform-output-secret",
            "terraformOutputSecretNamespace": "amp-system",
        };
        return args;
    }
    /**
     *
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     */
    deploy(ctx, workflowFilePath, workflowName, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            // Run the workflow
            yield this.argoClient.runWorkflow(ctx.logger, workflowFilePath, workflowName, false, debug);
        });
    }
    /**
     *
     */
    createAmpSystemNamespace() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.k8sClient.fetchRaw(`/api/v1/namespaces/amp-system`);
            }
            catch (error) {
                // Does not exist, create SA
                yield this.k8sClient.applyResource(`/api/v1/namespaces`, {
                    "apiVersion": "v1",
                    "kind": "Namespace",
                    "metadata": {
                        "name": "amp-system"
                    }
                });
            }
        });
    }
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
    prepareWorkflow(ctx, masterConfigJson, devDnsRootDomain, intDnsRootDomain, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, ampDataGitRepoUrl, ampCodeGitRepoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a unique name for the workflow
            let uid = new short_unique_id_1.default({ length: 5 });
            let uidGen = uid.rnd().toLowerCase();
            // Fetch the Amp workflow from the Amp workflow repository
            // NOTE: We do not use the target cluster to initiate this here because
            //       it queires the backstage Kube API to get the gitlab credentials,
            //       those are located on this cluster
            ctx.logger.info(' => Fetching Amp workflow from the workflow repository...');
            const workflow = yield new argo_1.ArgoClient().fetchWorkflowFromWorkflowRepo('amp/amp-setup.yaml');
            // Compute the arguments for the Amp installation
            ctx.logger.info(' => Preparing for Amp installation...');
            // Update the workflow with the computed arguments
            const args = this.computeArgumentsFile(ctx.input.gitlabGroupId, ctx.input.projectTitle, ctx.input.projectName, ctx.input.teamMailingList, devDnsRootDomain, intDnsRootDomain, ampDataGitRepoUrl, ampCodeGitRepoUrl, targetDevCertManagerIssuerName, targetDevCertManagerRootCertName, targetIntCertManagerIssuerName, targetIntCertManagerRootCertName, ctx.input.oauthClientId, ctx.input.terraformCleanupBeforeCreate ? true : false, `tmp-${uidGen}`);
            const gcpProjectId = JSON.parse(ctx.input.cloudCredentials).project_id;
            args.gitlabCredsSecretName = "backstage-secrets";
            args.gitlabCredsSecretNamespace = "backstage-system";
            args.resourceOwnerRef = ctx.input.catalogOwnerRef;
            args.targetBackstageSystem = ctx.input.targetSystem;
            args.targetBackstageSystemNormalized = backstageRegistrar_1.BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
            args.ampSpannerNormalizedName = masterConfigJson.config.ci.chunks.find((o) => o.type == "EnvConfig").value.environments.dev.db.instance.name;
            args.ampSpannerBackstageLinks = `- title: Spanner Instance\n  url: https://console.cloud.google.com/spanner/instances/${args.ampSpannerNormalizedName}/details/databases?project=${gcpProjectId}`;
            args.ampRedisIntNormalizedName = masterConfigJson.config.ci.chunks.find((o) => o.type == "EnvConfig").value.environments.integration.memstore.name;
            args.ampRedisIntBackstageLinks = `- title: Redis Integration Instance\n  url: https://console.cloud.google.com/memorystore/redis/locations/us-west1/instances/${args.ampRedisIntNormalizedName}/details/overview?project=${gcpProjectId}`;
            args.ampSetupNormalizedName = ctx.input.projectName;
            args.ampSetupDependsOnSpannerCompRef = `component:default/amp-spanner-instance-${args.ampSpannerNormalizedName}`;
            args.ampSetupDependsOnRedisIntCompRef = `component:default/amp-redis-${args.ampRedisIntNormalizedName}`;
            args.ampSetupDependsOnAxionDevCompRef = ctx.input.axionDevInstanceRef;
            args.ampSetupDependsOnAxionIntCompRef = ctx.input.axionIntInstanceRef;
            args.ampSetupBackstageLinks = `- title: AMP Console\n  url: game.${intDnsRootDomain}:443\n- title: AMP Data repository\n  url: ${ampDataGitRepoUrl}\n- title: AMP Code repository\n  url: ${ampCodeGitRepoUrl}`;
            const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
            const workflowName = `amp-setup-${ctx.input.projectName}-${uidGen}`;
            updatedWorkflow.metadata.name = workflowName;
            // Convert the JSON object to YAML format
            const yamlContent = yaml.dump(updatedWorkflow);
            uid = new short_unique_id_1.default({ length: 10 });
            const workflowFilePath = `./${uid.rnd()}-workflow-proxy.yaml`;
            const absolutePath = path.resolve(__dirname, workflowFilePath);
            // Write the YAML content to the specified file
            yield fs.writeFile(absolutePath, yamlContent, 'utf-8');
            return {
                uidGen: uidGen,
                workflowFilePath: absolutePath,
                workflowName: workflowName
            };
        });
    }
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx, cloudProvider, gcpRegion, uidGen) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createWorkflowScriptsConfigMap(ctx, this.k8sClient);
            // Create the Amp System namespace if it does not exist
            yield this.createAmpSystemNamespace();
            // Make sure we remove secret if it exists first
            try {
                yield this.k8sClient.fetchSecret("temporary-amp-credentials", "amp-system");
                yield this.k8sClient.deleteSecret("temporary-amp-credentials", "amp-system");
            }
            catch (_) { }
            // Create the temporary-amp-credentials secret
            yield this.k8sClient.applyResource(`/api/v1/namespaces/amp-system/secrets`, {
                apiVersion: "v1",
                data: {
                    "TARGET_CLOUD": Buffer.from(cloudProvider).toString('base64'),
                    "GCP_REGION": Buffer.from(gcpRegion).toString('base64'),
                    "GCP_JSON_KEY": Buffer.from(ctx.input.cloudCredentials).toString('base64'),
                    "GITLAB_TOKEN": Buffer.from(ctx.input.gitlabGroupAuthToken).toString('base64')
                },
                kind: "Secret",
                metadata: {
                    name: `tmp-${uidGen}`
                },
                type: "Opaque"
            });
            return {
                tmpCredsSecretName: `tmp-${uidGen}`
            };
        });
    }
}
exports.AmpController = AmpController;
