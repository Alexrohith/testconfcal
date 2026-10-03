import ConferenceDetails from "@/components/conferences/ConferenceDetails";

export default async function ConferencePage({ params }: PageProps<"/conferences/[id]">) {
  const { id } = await params;
  return <ConferenceDetails id={id} />;
}
