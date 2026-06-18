# Build Project Workflow

This workflow details the steps to install dependencies, compile, and build the SignatureCRM Next.js project.

## Prerequisites
- Node.js version 20 or higher (recommended 24)
- npm (comes with Node.js)
- Firebase CLI (optional, for Firebase Studio export)

## Steps

### 1. Install Dependencies
Run the following command in the project root directory:
```bash
npm install
```
This will install all required packages listed in `package.json` and `package-lock.json`.

### 2. Environment Configuration
Ensure the following environment variables are set (if needed):
- Create a `.env` file based on `.env.example` (if exists) with Firebase configuration.
- Required Firebase environment variables:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

### 3. TypeScript Type Checking (Optional)
Run type checking to ensure no TypeScript errors:
```bash
npm run typecheck
```

### 4. Build the Project
Execute the Next.js production build:
```bash
npm run build
```
This command uses `cross-env` to set `NODE_ENV=production` and runs `next build`. The build output will be placed in the `.next` directory.

### 5. Verify Build Output
After successful build, you can start the production server locally:
```bash
npm start
```
The server will run on `http://localhost:3000` (default).

## Troubleshooting
- **Windows users**: If `npm run build` fails due to environment variable issues, ensure `cross-env` is installed (it's already added as a dev dependency).
- **Firebase errors**: If the build fails due to missing Firebase config, check that the environment variables are correctly set.
- **Memory issues**: If the build runs out of memory, increase Node.js memory limit with `NODE_OPTIONS=--max-old-space-size=4096`.

## Notes
- The project uses Next.js 14 with App Router, Tailwind CSS, and Firebase integration.
- PWA (Progressive Web App) is configured via `next-pwa`; service worker is generated during build.
- The build process also generates static pages for many routes (as seen in the build output).