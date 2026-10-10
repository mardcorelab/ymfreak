/** Re-mounts on every navigation, so each page arrives with a soft fade (see .page-enter). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
