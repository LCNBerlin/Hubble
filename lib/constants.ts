/** Fallback label when a post has no title */
export const UNTITLED_POST = "Untitled post";

export const CREATOR_AVATAR = require("../assets/images/icon.png");

export const POST_TYPE_LABELS: Record<string, string> = {
  blog: "Text",
  picture: "Photo",
  audio: "Audio",
  video: "Video",
  polls: "Polls",
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  digital: "Digital",
  physical: "Physical",
  membership: "Membership",
  services: "Service",
};

export const TYPE_ICONS: Record<string, string> = {
  blog: "document-text",
  picture: "image",
  audio: "musical-notes",
  video: "videocam",
  polls: "stats-chart",
  digital: "cloud-download",
  physical: "cube",
  membership: "people",
  services: "construct",
};
