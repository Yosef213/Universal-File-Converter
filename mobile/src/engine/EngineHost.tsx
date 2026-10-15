import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Hidden WebView that hosts the offline engine (pdf.js, mammoth, docx, SheetJS).
 * Everything is bundled inside assets/engine/engine.html, so no network is used.
 */

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

let webRef: WebView | null = null;
let ready = false;
let readyWaiters: Array<() => void> = [];
const pending = new Map<string, Pending>();
let counter = 0;

export class EngineError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function waitReady(timeoutMs = 20000): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Conversion engine failed to start.')), timeoutMs);
    readyWaiters.push(() => {
      clearTimeout(t);
      resolve();
    });
  });
}

export async function callEngine<T = any>(method: string, args: Record<string, any> = {}): Promise<T> {
  await waitReady();
  const reqId = `r${++counter}_${Date.now()}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    webRef?.postMessage(JSON.stringify({ reqId, method, args }));
  });
}

function onMessage(e: WebViewMessageEvent) {
  let msg: any;
  try {
    msg = JSON.parse(e.nativeEvent.data);
  } catch {
    return;
  }
  if (msg.ready) {
    ready = true;
    readyWaiters.forEach((w) => w());
    readyWaiters = [];
    return;
  }
  const p = pending.get(msg.reqId);
  if (!p) return;
  pending.delete(msg.reqId);
  if (msg.error) p.reject(new EngineError(msg.error, msg.code));
  else p.resolve(msg.result);
}

export const EngineHost: React.FC = () => {
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(require('../../assets/engine/engine.html'));
      await asset.downloadAsync();
      const content = await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri);
      setHtml(content);
    })().catch((err) => console.error('Engine load failed', err));
  }, []);

  useEffect(() => {
    webRef = ref.current;
  });

  if (!html) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'about:blank' }}
        onMessage={onMessage}
        javaScriptEnabled
        onContentProcessDidTerminate={() => {
          ready = false;
          ref.current?.reload();
        }}
        onRenderProcessGone={() => {
          ready = false;
          ref.current?.reload();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
  },
});
