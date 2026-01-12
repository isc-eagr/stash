import React, { useMemo } from "react";
import { Badge, Button } from "react-bootstrap";
import { useIntl } from "react-intl";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";

// Special ID for the "(Any)" performer option
export const ANY_PERFORMER_ID = "__any__";

// Helper to check if a performer ID is the special "(Any)" ID
export function isAnyPerformer(id: string): boolean {
  return id === ANY_PERFORMER_ID;
}

// Helper to count how many "(Any)" performers are in a list
export function countAnyPerformers(ids: Array<{ id: string }>): number {
  return ids.filter((p) => isAnyPerformer(p.id)).length;
}

// Helper to filter out "(Any)" performers from a list (for sending to backend)
export function filterRealPerformers<T extends { id: string }>(
  performers: T[]
): T[] {
  return performers.filter((p) => !isAnyPerformer(p.id));
}

// Create a fake "(Any)" performer object with a unique key suffix
export function createAnyPerformer(index: number): Performer {
  return {
    id: `${ANY_PERFORMER_ID}_${index}`,
    name: "(Any)",
    alias_list: [],
    disambiguation: null,
    image_path: null,
    birthdate: null,
    death_date: null,
  };
}

// Check if an ID starts with the ANY_PERFORMER_ID prefix
export function isAnyPerformerId(id: string): boolean {
  return id.startsWith(ANY_PERFORMER_ID);
}

interface IPerformerWithAnySelectProps {
  ids: string[];
  onSelect: (performers: Performer[]) => void;
  menuPortalTarget?: HTMLElement | null;
  disabled?: boolean;
}

/**
 * A performer select component that includes "(Any)" as a special selectable option.
 * "(Any)" can be selected multiple times - each selection counts toward the any_count.
 * Real performers and "(Any)" selections are tracked together.
 */
export const PerformerWithAnySelect: React.FC<IPerformerWithAnySelectProps> = ({
  ids,
  onSelect,
  menuPortalTarget,
  disabled,
}) => {
  const intl = useIntl();

  // Reconstruct performer objects from IDs, including "(Any)" entries
  const performers = useMemo(() => {
    const result: Performer[] = [];
    let anyIndex = 0;

    for (const id of ids) {
      if (isAnyPerformerId(id)) {
        // It's an "(Any)" entry - create a fake performer
        result.push(createAnyPerformer(anyIndex++));
      } else {
        // Real performer - will be loaded by PerformerIDSelect
        result.push({
          id,
          name: "", // Will be populated by the select component
          alias_list: [],
          disambiguation: null,
          image_path: null,
          birthdate: null,
          death_date: null,
        });
      }
    }

    return result;
  }, [ids]);

  // Count current "(Any)" selections
  const anyCount = ids.filter(isAnyPerformerId).length;

  // Handle performer selection
  const handleSelect = (selected: Performer[]) => {
    onSelect(selected);
  };

  // Handle adding an "(Any)" performer
  const handleAddAny = () => {
    const newAny = createAnyPerformer(anyCount);
    const currentPerformers = [...performers, newAny];
    onSelect(currentPerformers);
  };

  // Get real performer IDs (excluding "(Any)" entries)
  const realIds = ids.filter((id) => !isAnyPerformerId(id));

  return (
    <div className="performer-with-any-select">
      <PerformerIDSelect
        isMulti
        ids={realIds}
        onSelect={(selected) => {
          // Merge real performers with existing "(Any)" entries
          const anyPerformers = performers.filter((p) =>
            isAnyPerformerId(p.id)
          );
          handleSelect([...selected, ...anyPerformers]);
        }}
        menuPortalTarget={menuPortalTarget}
        isDisabled={disabled}
      />
      <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={handleAddAny}
          disabled={disabled}
          title={intl.formatMessage({
            id: "add_any_performer",
            defaultMessage: "Add (Any) performer",
          })}
        >
          + (Any)
        </button>
        {anyCount > 0 && (
          <div className="d-flex align-items-center gap-1 flex-wrap">
            {Array.from({ length: anyCount }).map((_, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="tag-item d-flex align-items-center"
              >
                (Any)
                <Button
                  className="minimal ml-1"
                  onClick={() => {
                    // Remove one "(Any)" entry
                    const anyPerformers = performers.filter((p) =>
                      isAnyPerformerId(p.id)
                    );
                    if (anyPerformers.length > 0) {
                      const realPerformers = performers.filter(
                        (p) => !isAnyPerformerId(p.id)
                      );
                      anyPerformers.pop(); // Remove last "(Any)"
                      onSelect([...realPerformers, ...anyPerformers]);
                    }
                  }}
                  disabled={disabled}
                >
                  <Icon icon={faTimes} />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
