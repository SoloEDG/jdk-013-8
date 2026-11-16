import { people } from "../../../shared/content";
export function findPerson(id: string) {
  return people.find((p) => p.id === id);
}
export function readingDuration(paragraphs: string[]) {
  return Math.ceil(paragraphs.join("").length / 4);
}
