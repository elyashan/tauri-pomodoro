import type { TagKind } from "../../db";
import type { TagFormState } from "../../constants";

export interface TagManagementHandlers {
  tagForm: TagFormState | null;
  onChangeTagForm: (next: TagFormState | null) => void;
  onSubmitTagForm: () => void;
  onAddNewTag: (kind: TagKind) => void;
  onEditTagItem: (tagId: number, currentName: string, kind: TagKind) => void;
  onDeleteTagItem: (tagId: number, name: string, kind: TagKind) => void;
}
