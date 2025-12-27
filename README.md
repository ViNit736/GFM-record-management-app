# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## 🔄 Auto-Sync Feature

This project uses an **Auto-Sync** workflow to ensure your development journey is smooth and secure. Every time I (the AI assistant) help you implement a feature or fix a bug, the changes are automatically backed up to your GitHub repository.

### Why Auto-Sync?
- **Logical Security**: It acts as an automatic "Save" button, ensuring no work is ever lost.
- **Humanized History**: You can see exactly how the project evolved step-by-step in your commit history.
- **Consistency**: It keeps your local workspace and remote repository in perfect harmony without any manual effort.

## 📝 Recent Development Log

To provide more logical context than the automated commit messages, here is a summary of the actual work completed in the recent updates:

### **PDF Generation Engine**
- **File**: `services/pdf-template.service.ts`
- **Actions**: 
    - Fixed "Blank Screen" issue in PDF preview.
    - Restructured the HTML template for better visual consistency.
    - Updated category labels (e.g., changed "Technical Skills" to "Academic Achievements").
    - Optimized CSS for print layout.

### **Dashboard Enhancements**
- **Files**: `app/student/dashboard.tsx`, `app/teacher/dashboard.tsx`
- **Actions**:
    - Improved dashboard UI with modern card designs.
    - Integrated real-time achievement counts from SQLite.
    - Added "Quick Action" buttons for faster navigation.
    - Enhanced data fetching logic to ensure offline persistence.

### **Data Storage & Migrations**
- **File**: `storage/sqlite.ts`
- **Actions**:
    - Implemented database migrations to support new achievement types.
    - Added utility functions for counting records by category.
    - Optimized query performance for dashboard loading.

### **Student Records**
- **File**: `app/student/achievements.tsx`
- **Actions**:
    - Fixed list rendering issues.
    - Added better empty state handling.
