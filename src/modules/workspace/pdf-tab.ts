/** The PDF has already been fetched with authorization; credentials never enter the tab URL. */
export function openPdfTab(pdf: Blob): boolean {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return false;
  let url: string | undefined;
  try {
    tab.opener = null;
    url = URL.createObjectURL(pdf);
    tab.location.replace(url);
    // Keep this URL valid when the user leaves the workspace. Its lifetime belongs
    // to the opened tab, rather than to the editor component or the next PDF job.
    const openedUrl = url;
    const timer = window.setInterval(() => {
      if (!tab.closed) return;
      window.clearInterval(timer);
      URL.revokeObjectURL(openedUrl);
    }, 1000);
    return true;
  } catch {
    if (url) URL.revokeObjectURL(url);
    tab.close();
    return false;
  }
}
