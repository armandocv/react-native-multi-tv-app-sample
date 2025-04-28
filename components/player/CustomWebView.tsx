import React, { forwardRef } from 'react';
import WebView, { WebViewProps } from 'react-native-webview';

// Create a forwardRef WebView component to properly handle refs
const CustomWebView = forwardRef<WebView, WebViewProps>((props, ref) => {
  return <WebView {...props} ref={ref} />;
});

// Add display name for debugging
CustomWebView.displayName = 'CustomWebView';

export default CustomWebView;
