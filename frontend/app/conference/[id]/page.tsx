import ConferenceDetails from "@/components/conferences/ConferenceDetails";

export default async function ConferencePage({ params }: PageProps<"/conference/[id]">) {
  const { id } = await params;
  return <ConferenceDetails id={id} />;
}