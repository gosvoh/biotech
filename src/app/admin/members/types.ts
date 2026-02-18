import type {
  Department,
  Discipline,
  Member,
  ScientificWork,
} from "@/lib/db/client";

export type MemberWithRelations = Member & {
  disciplines: Discipline[];
  scientificWorks: ScientificWork[];
};

export type MembersClientProps = {
  members: MemberWithRelations[];
  departments: Department[];
  disciplines: Discipline[];
  scientificWorks: ScientificWork[];
};

export type MemberEditModalProps = {
  member?: MemberWithRelations;
  departments: Department[];
  scientificWorks: ScientificWork[];
  disciplines: Discipline[];
  open: boolean;
  close: () => void;
};

export type MemberImageCropModalProps = {
  open: boolean;
  imageSrc?: string;
  imageName?: string;
  imageType?: string;
  onCancel: () => void;
  onApply: (croppedFile: File) => void;
};
