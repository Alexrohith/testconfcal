export default function SaveConferenceButton({ conferenceId, title }: {
  conferenceId: number;
  title: string;
}) {
  return (
    <button
      className="save-conference-link"
      type="button"
      data-conference-id={conferenceId}
      aria-label={`Save unavailable for ${title}`}
      title="Saving requires saved-conference database policies that are not configured yet."
      disabled
    >
      &#9825; Save
    </button>
  );
}