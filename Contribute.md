# How to Submit Your Module

## Prepare Your Module
Ensure your module meets these requirements:

✅ **Deployed on Supra Testnet**
- Your module must be deployed and accessible
- Test all entry functions thoroughly

✅ **GitHub Repository**
- Create a public repository with your module code
- Include a comprehensive README with:
  - Module description and use case
  - Entry function documentation
  - Parameter explanations
  - Example usage

✅ **Code Quality**
- Follow Supra Move best practices
- Include error handling
- Add comments for complex logic

## Fork the Repository

1. Go to https://github.com/Supra-Labs/Supra-Automation-assist
2. Click the "Fork" button in the top-right

## Add Your Module

1. Open `marketplace/modules.json`

2. Add your module entry in the `modules` array:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-01-15T10:00:00Z",
  "modules": [
    // ... existing modules ...
    {
      "name": "Your Module Name",
      "description": "Brief description of what your module does (1-2 sentences)",
      "category": "ANY THAT BEST SUITS YOUR MODULE",  // NFT, Payments, SocialFi, Trading
      "address": "ADDRESS YOUR MODULE IS DEPLOYED ON",
      "module": "your_module_name",
      "githubRepo": "https://github.com/yourusername/your-module-repo",
      "contributor": "Your Name",
      "verified": false  // Keep as false - will be set to true after review
    }
  ]
}
```

**Important:**
- Add your module at the **end** of the array (before the closing `]`)
- Update the `lastUpdated` timestamp to current date/time
- Keep `verified: false` - maintainers will change this after review
- Ensure valid JSON syntax (use a JSON validator)

## Create Pull Request

1. Go to your fork on GitHub
2. Click "Contribute" → "Open pull request"
3. Fill out the PR template with:
   - Module details
   - Description
   - Testing information
   - Checklist confirmations
4. Click "Create pull request"

## PR Review Process

1. **Manual Review** (2-5 business days)
   - Code quality review
   - Testnet deployment verification
   - Documentation check
   - Security assessment

2. **Feedback**
   - You may receive comments or change requests
   - Address feedback and push updates

3. **Approval & Merge**
   - Once approved, your PR will be merged
   - Your module appears on the website immediately!

## Categories

Choose the most appropriate category:

| Category | Use Cases |
|----------|-----------|
| **NFT** | Minting, trading, collections |
| **Payments** | Payment processing, subscriptions |
| **SocialFi** | Social features, rewards, engagement |
| **Trading** | Trading bots, arbitrage, portfolios |

## 🔍 Verification Status

### `verified: false` (Default)
- Community contribution
- Under review or newly added
- Use at own risk

### `verified: true` (After review)
- Reviewed by Supra Labs team
- Tested on testnet
- Meets quality standards
- Security checked

**Note:** Only maintainers can set `verified: true`

### Increase chances of quick approval:

✅ **Clear Description** - Explain what problem your module solves

✅ **Good Documentation** - Make it easy for others to use

✅ **Test Thoroughly** - Provide test transaction hashes

✅ **Follow Template** - Complete all sections of the PR template

✅ **Valid JSON** - Always validate before submitting

✅ **Unique Value** - Offer something new or better

### Common Mistakes to Avoid

❌ **Invalid JSON syntax** - Missing commas, brackets, quotes

❌ **Wrong address format** - Must be 66 characters starting with 0x

❌ **Missing comma** - Between module entries

❌ **Setting verified: true** - Only maintainers can verify

❌ **Incomplete documentation** - Module won't be approved

❌ **Untested code** - Test on testnet first

## After Your Module is Merged
Once merged, your module will:

- ✅ Appear on the marketplace website immediately
- ✅ Be discoverable via search and filters
- ✅ Show your contributor name
- ✅ Include a link to your GitHub repo
- ✅ Get the verified badge (after review)
