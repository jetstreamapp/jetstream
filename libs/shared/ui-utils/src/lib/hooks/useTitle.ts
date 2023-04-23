export function useTitle(title: string) {
  if (document.title !== title) {
    document.title = title;
  }
}
