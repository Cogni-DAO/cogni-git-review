import nock from 'nock';

export function mockInstallationAuth(installationId, times = 4, token = 'ghs_test_token') {
  return nock('https://api.github.com')
    .post(`/app/installations/${installationId}/access_tokens`)
    .times(times)
    .reply(function(uri, requestBody) {
      console.log('🔍 AUTH TOKEN REQUEST:', uri);
      return [200, { 
        token, 
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read"
        }, 
        repositories: [] 
      }];
    });
}

export function mockCreateCheckRun(owner, repo) {
  return nock('https://api.github.com')
    .post(`/repos/${owner}/${repo}/check-runs`)
    .reply(201, { 
      id: 123, 
      status: 'completed', 
      conclusion: 'success' 
    });
}

export function mockGetFileContents(owner, repo, path, ref, content) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`)
    .query({ ref })
    .reply(200, {
      type: "file",
      content: Buffer.from(content).toString('base64'),
      encoding: "base64"
    });
}

export function mockGetFileNotFound(owner, repo, path, ref) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`)
    .query({ ref })
    .reply(404, { message: "Not Found" });
}