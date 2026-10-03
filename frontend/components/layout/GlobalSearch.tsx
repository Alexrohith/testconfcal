export default function GlobalSearch() {
  return (
    <form className="global-search" action="/explore" role="search">
      <label className="sr-only" htmlFor="global-conference-search">Search conferences</label>
      <input
        id="global-conference-search"
        name="search"
        type="search"
        placeholder="Search conferences"
      />
      <button type="submit">Search</button>
    </form>
  );
}