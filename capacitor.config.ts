import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lokl.app',
  appName: 'Lokl',
  webDir: 'dist',
  server: {
    // androidScheme controls the Android WebView's URL scheme (app runs at
    // https://localhost). iosScheme is the equivalent for iOS — WKWebView reserves
    // real https:// for remote URLs, so local bundled content is always served over a
    // custom scheme there; 'capacitor' is Capacitor's own default and is made explicit
    // here rather than implicit, since an earlier config mistake (see below) caused
    // real confusion about what the app's actual origin is. Any future OAuth redirect
    // configuration must target capacitor://localhost, not https://localhost and not
    // a scheme named after the app.
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    // This is the Xcode *build scheme* name, not a URL scheme — Capacitor's type
    // declarations default it to 'App', matching the only target/scheme that actually
    // exists in ios/App/App.xcodeproj (there is no shared scheme named "Lokl" anywhere
    // under ios/). The previous value here ('Lokl') was a real defect: `cap run ios`/
    // `cap build ios` would have failed looking for a nonexistent Xcode scheme. See
    // docs/audit/FINDINGS.md LOKL-006's Step 1 correction.
    scheme: 'App',
  },
};

export default config;
