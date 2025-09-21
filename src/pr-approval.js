/**
 * PR Approval System - Future Implementation
 * Handles automated PR approvals with validation guards and idempotency
 */

/**
 * Approve PR with validation guards and idempotency
 * @param {Object} context - Probot context
 * @param {number} prNumber - PR number to approve
 * @param {string} evaluatedSha - SHA that was evaluated (for validation)
 * @param {string} approvalReason - Reason for approval
 */
export async function approvePRWithGuards(context, prNumber, evaluatedSha, approvalReason = 'Cogni automated approval') {
  try {
    // Guard: Fetch current PR state
    const { data: pr } = await context.octokit.pulls.get(context.repo({ pull_number: prNumber }));
    
    // Guard: Validate PR head SHA matches what we evaluated
    if (pr.head.sha !== evaluatedSha) {
      console.log(`🔒 APPROVAL: Skipping approval - PR #${prNumber} head SHA mismatch (expected: ${evaluatedSha.slice(0, 7)}, actual: ${pr.head.sha.slice(0, 7)})`);
      return { skipped: true, reason: 'sha_mismatch' };
    }

    // Idempotency: Check for existing approval with our tag
    const idempotencyTag = `[cogni-approve:${evaluatedSha}]`;
    const { data: reviews } = await context.octokit.pulls.listReviews(context.repo({ pull_number: prNumber }));
    
    const existingApproval = reviews.find(review => 
      review.state === 'APPROVED' && 
      review.body && 
      review.body.includes(idempotencyTag)
    );

    if (existingApproval) {
      console.log(`🔒 APPROVAL: Already approved PR #${prNumber} for SHA ${evaluatedSha.slice(0, 7)} (review #${existingApproval.id})`);
      return { skipped: true, reason: 'already_approved', existingReview: existingApproval };
    }

    // Create approval review with idempotency tag
    const reviewBody = `${approvalReason}\n\n${idempotencyTag}`;
    const { data: review } = await context.octokit.pulls.createReview(context.repo({
      pull_number: prNumber,
      event: 'APPROVE',
      body: reviewBody
    }));

    console.log(`🔒 APPROVAL: Approved PR #${prNumber} for SHA ${evaluatedSha.slice(0, 7)} (review #${review.id})`);
    return { approved: true, review };

  } catch (error) {
    console.error(`🔒 APPROVAL: Failed to approve PR #${prNumber}:`, error);
    return { error: true, message: error.message };
  }
}

/**
 * Check if PR is already approved by Cogni for a specific SHA
 * @param {Object} context - Probot context
 * @param {number} prNumber - PR number
 * @param {string} sha - SHA to check approval for
 */
export async function isAlreadyApprovedByCogni(context, prNumber, sha) {
  try {
    const idempotencyTag = `[cogni-approve:${sha}]`;
    const { data: reviews } = await context.octokit.pulls.listReviews(context.repo({ pull_number: prNumber }));
    
    return reviews.some(review => 
      review.state === 'APPROVED' && 
      review.body && 
      review.body.includes(idempotencyTag)
    );
  } catch (error) {
    console.error(`🔒 APPROVAL: Failed to check existing approvals for PR #${prNumber}:`, error);
    return false;
  }
}