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
exports.gitlab = void 0;
exports.gitlab = {
    // Fetch a text file from a GitLab repository
    downloadFile: (repositoryId, filePath, branchOrTag, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(branchOrTag)}`;
        const response = yield fetch(url, {
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            }
        });
        if (!response.ok) {
            console.error(`Failed to fetch file from GitLab: ${url}`);
            throw new Error(`Failed to fetch file from GitLab: ${response.statusText}`);
        }
        return yield response.text();
    }),
    // Upload a text file to a GitLab repository
    uploadTextFile: (repositoryId, filePath, branchOrTag, personalAccessToken, content) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}`;
        // CHeck and see if it's a PUT or POST
        let method = 'POST';
        let response = yield fetch(`${url}?ref=${branchOrTag}`, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });
        if (response.ok) {
            method = 'PUT';
        }
        else if (response.status === 404) {
            method = 'POST';
        }
        else {
            const error = yield response.json();
            throw new Error(`Failed to check file: ${error.message}`);
        }
        response = yield fetch(url, {
            method,
            body: JSON.stringify({
                branch: branchOrTag,
                content: content,
                commit_message: 'Add file via API',
            }),
            headers: {
                'Content-Type': 'application/json',
                'PRIVATE-TOKEN': personalAccessToken
            }
        });
        if (!response.ok) {
            console.error(`Failed to upload file to GitLab: ${url}`);
            throw new Error(`Failed to upload file to GitLab: ${response.statusText}`);
        }
    }),
    // Upload a text file to a GitLab repository
    fetchFile: (repositoryId, filePath, branchOrTag, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const url = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/files/${encodeURIComponent(filePath)}`;
        console.log(url);
        let response = yield fetch(`${url}?ref=${branchOrTag}`, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });
        if (response.ok) {
            return response.json();
        }
        else {
            const error = yield response.json();
            throw new Error(`Failed to check file: ${error.message}`);
        }
    }),
    /**
     *
     * @param repositoryId
     * @param folderPath
     * @param branch
     * @param personalAccessToken
     * @returns
     */
    getFilesFromFolder: (repositoryId, folderPath, branch, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const endpoint = `https://gitlab.ea.com/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/tree?path=${encodeURIComponent(folderPath)}&ref=${branch}`;
        const response = yield fetch(endpoint, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personalAccessToken
            },
        });
        if (!response.ok) {
            throw new Error('Failed to fetch folder content');
        }
        const files = yield response.json();
        return files.filter((file) => file.type === 'blob').map((file) => file.path); // Filter to get only files, not directories
    }),
    /**
     * getSubgroupIdByName
     * @param search
     * @param personalAccessToken
     * @returns
     */
    getSubgroupIdByName: (search, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const apiUrl = `https://gitlab.ea.com/api/v4/groups?search=${encodeURIComponent(search)}`;
        const response = yield fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${yield response.text()}`);
        }
        const groups = yield response.json();
        const group = groups[0];
        if (!group) {
            throw new Error('Group not found');
        }
        return group.id;
    }),
    /**
     * getSubgroupIdByName
     * @param search
     * @param personalAccessToken
     * @returns
     */
    getGroupNameByGroupId: (groupId, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const apiUrl = `https://gitlab.ea.com/api/v4/groups/${groupId}`;
        const response = yield fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${yield response.text()}`);
        }
        const group = yield response.json();
        if (!group) {
            throw new Error('Group not found');
        }
        return group.name;
    }),
    /**
     * createGitlabRepoCiVar
     * @param projectId
     * @param personalAccessToken
     * @param varKey
     * @param varValue
     * @param masked
     */
    createGitlabRepoCiVar: (projectId, personalAccessToken, varKey, varValue, masked) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch(`https://gitlab.ea.com/api/v4/projects/${projectId}/variables`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${personalAccessToken}`,
            },
            body: JSON.stringify({
                key: varKey,
                value: varValue,
                masked: masked,
            })
        });
        if (!response.ok) {
            throw new Error(`Could not create the repo variable: ${yield response.text()}`);
        }
    }),
    /**
     * createGitlabRepo
     * @param options
     * @param personalAccessToken
     * @returns
     */
    createGitlabRepo: (options, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        let body = null;
        if (!options.namespaceId || options.namespaceId == null || options.namespaceId == "") {
            body = JSON.stringify({
                name: options.name,
                description: options.description,
                visibility: options.visibility,
            });
        }
        else {
            body = JSON.stringify({
                name: options.name,
                namespace_id: options.namespaceId,
                description: options.description,
                visibility: options.visibility,
            });
        }
        /**
         * Create a new GitLab repository
         */
        const response = yield fetch(`https://gitlab.ea.com/api/v4/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${personalAccessToken}`,
            },
            body: body,
        });
        if (!response.ok) {
            throw new Error(`Could not create the repository: ${yield response.text()}`);
        }
        let gitResponse = yield response.json();
        // return gitResponse.http_url_to_repo
        return gitResponse;
    }),
    /**
     * deleteRepo
     * @param groupName
     * @param repoName
     * @param personalAccessToken
     */
    deleteRepoIfExist: (groupName, repoName, personalAccessToken) => __awaiter(void 0, void 0, void 0, function* () {
        const searchString = `${groupName}/${repoName}`;
        const apiUrl = `https://gitlab.ea.com/api/v4/search?scope=projects&search=${encodeURIComponent(searchString)}`;
        let response = yield fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Could not fetch the groups: ${yield response.text()}`);
        }
        const allProjects = yield response.json();
        const targetProjectBlock = allProjects.find((project) => project.path_with_namespace == searchString || project.path_with_namespace.endsWith("/" + searchString));
        if (targetProjectBlock) {
            response = yield fetch(`https://gitlab.ea.com/api/v4/projects/${targetProjectBlock.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${personalAccessToken}`,
                }
            });
            if (!response.ok) {
                throw new Error(`Could not delete the repository: ${yield response.text()}`);
            }
        }
    })
};
