# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/2ef49cca-cba6-4684-88ab-6fc3b04f0484

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/2ef49cca-cba6-4684-88ab-6fc3b04f0484) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/2ef49cca-cba6-4684-88ab-6fc3b04f0484) and click on Share -> Publish.

## Deploy to Google Cloud Run (CI with Cloud Build)

This project includes a `cloudbuild.yaml` that builds the Docker image and deploys it to Cloud Run. The build requires two Vite environment values to be provided at build-time:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Recommended (secure) flow: use Secret Manager and the provided helper script.

Quick automated steps (from your machine):

1. Ensure `gcloud` is installed and you're authenticated:

```powershell
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>
```

2. Run the helper script to create secrets, grant access to Cloud Build and submit the build.

```powershell
# from the repo root
powershell.exe -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun.ps1 -ProjectId <YOUR_PROJECT_ID>
```

The script will prompt for the two Vite values (it won't store them in plaintext in the repo). After submission Cloud Build will build the image and deploy to Cloud Run.

Alternative (quick test): pass substitutions on build submit (not recommended for secrets in CI):

```powershell
gcloud builds submit --config cloudbuild.yaml --substitutions=_VITE_SUPABASE_URL="https://...",_VITE_SUPABASE_PUBLISHABLE_KEY="pk_..."
```

If you need help running the script or want me to prepare a Cloud Build trigger configuration, dime y te guío paso a paso.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
