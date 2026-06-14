# How to Force Push to Protected GitHub Repository

## The Issue
GitHub has **repository rules** enabled that prevent force pushing to the `main` branch.

**Error**: `GH013: Repository rule violations found for refs/heads/main`

## Solution: Temporarily Disable Branch Protection

### Step 1: Go to Repository Settings
1. Open your browser and go to: https://github.com/WAQASUMAR33/changeworks
2. Click on **Settings** tab (top right)
3. In the left sidebar, click on **Rules** → **Rulesets**

### Step 2: Disable or Edit the Ruleset
You'll see one or more rulesets protecting your branches. You have two options:

#### Option A: Temporarily Disable the Ruleset
1. Find the ruleset that applies to `main` branch
2. Click on the ruleset name
3. Click **Edit** or the three dots (⋮) menu
4. Click **Disable ruleset** or toggle it off
5. Confirm the action

#### Option B: Edit the Ruleset to Allow Force Push
1. Find the ruleset that applies to `main` branch
2. Click **Edit**
3. Scroll down to **Rules** section
4. Find **"Restrict force pushes"** or **"Require linear history"**
5. Uncheck or disable these options
6. Click **Save changes**

### Step 3: Force Push Your Code
Once the protection is disabled, run:

```bash
git push origin main --force
```

### Step 4: Re-enable Protection (Optional)
After successfully pushing, you can re-enable the branch protection:
1. Go back to **Settings** → **Rules** → **Rulesets**
2. Enable the ruleset again or restore the previous settings

---

## Alternative: Use GitHub Web Interface

If you don't want to disable protections, you can:

### Option 1: Delete and Recreate Main Branch on GitHub
1. Go to https://github.com/WAQASUMAR33/changeworks
2. Click on **Settings** → **Branches**
3. Change the default branch to another branch (create one if needed)
4. Delete the `main` branch
5. Push your local `main` branch
6. Set `main` as default branch again

### Option 2: Create a Pull Request
1. Push to a new branch:
   ```bash
   git checkout -b fresh-start
   git push origin fresh-start
   ```
2. Go to GitHub and create a Pull Request from `fresh-start` to `main`
3. Merge the PR (this might still be blocked by rules)

---

## Quick Commands Reference

### After Disabling Protection:
```bash
# Force push to main
git push origin main --force

# Verify it worked
git log origin/main --oneline -5
```

### Alternative - Push to New Branch:
```bash
# Create and push to new branch
git checkout -b fresh-start
git push origin fresh-start

# Then on GitHub, make fresh-start the default branch
# and delete old main
```

---

## What Happens After Force Push

✅ Your local commits will replace all remote commits  
✅ Remote `main` will have only your 2 commits  
✅ Old commit history will be deleted from remote  
✅ Anyone who cloned the old repo will need to re-clone or reset  

---

## Need Help?

If you're having trouble with GitHub settings, let me know and I can guide you through the specific screens!
