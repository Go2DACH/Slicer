import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { loadFromFiles, loadFromUrl, describeLoadError } from '../lib/loaders';

/** Resolve a model URL relative to the deploy base path when it is relative. */
function resolveModelUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = raw.replace(/^\//, '');
  return `${base}/${path}`;
}

export function useModelLoading() {
  const setModel = useStore((s) => s.setModel);
  const setLoading = useStore((s) => s.setLoading);
  const setLoadProgress = useStore((s) => s.setLoadProgress);
  const setLoadError = useStore((s) => s.setLoadError);
  const setReadonly = useStore((s) => s.setReadonly);
  const startedRef = useRef(false);

  const loadFiles = useCallback(
    async (files: File[]) => {
      setLoadError(null);
      setLoading(true);
      try {
        const { object, info } = await loadFromFiles(files, (f) => setLoadProgress(f));
        const urls = (object.userData.objectUrls as string[]) ?? [];
        setModel(object, info, urls);
      } catch (err) {
        setLoadError(describeLoadError(err));
      } finally {
        setLoading(false);
      }
    },
    [setModel, setLoading, setLoadProgress, setLoadError],
  );

  const loadUrl = useCallback(
    async (modelUrl: string, mtlUrl?: string) => {
      const resolved = resolveModelUrl(modelUrl);
      setLoadError(null);
      setLoading(true);
      try {
        const { object, info } = await loadFromUrl(resolved, { mtlUrl: mtlUrl ? resolveModelUrl(mtlUrl) : undefined }, (f) =>
          setLoadProgress(f),
        );
        setModel(object, info, []);
      } catch (err) {
        setLoadError(describeLoadError(err, resolved));
      } finally {
        setLoading(false);
      }
    },
    [setModel, setLoading, setLoadProgress, setLoadError],
  );

  // Parse URL params once on startup.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'readonly') setReadonly(true);
    const model = params.get('model');
    if (model) {
      const mtl = params.get('mtl') ?? undefined;
      void loadUrl(model, mtl);
    }
  }, [loadUrl, setReadonly]);

  return { loadFiles, loadUrl };
}
