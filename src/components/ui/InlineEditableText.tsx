"use client";

import * as React from "react";

type InlineEditableTextProps = {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  className?: string;
};

export default function InlineEditableText({
  value,
  onSave,
  className,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [displayValue, setDisplayValue] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const startValueRef = React.useRef(value);

  // Keep internal display in sync when not actively editing.
  React.useEffect(() => {
    if (!isEditing) {
      setDisplayValue(value);
      startValueRef.current = value;
    }
  }, [value, isEditing]);

  const startEdit = React.useCallback(() => {
    if (saving) return;
    startValueRef.current = displayValue;
    setDraft(displayValue);
    setIsEditing(true);
  }, [displayValue, saving]);

  const cancelEdit = React.useCallback(() => {
    setIsEditing(false);
    setDraft(startValueRef.current);
  }, []);

  const commitEdit = React.useCallback(async () => {
    if (saving) return;
    const trimmed = draft.trim();
    const startValue = startValueRef.current;
    if (!trimmed || trimmed === startValue) {
      setIsEditing(false);
      setDraft(startValue);
      return;
    }
    // Optimistic update
    setDisplayValue(trimmed);
    setIsEditing(false);
    setSaving(true);
    try {
      await Promise.resolve(onSave(trimmed));
      // Parent is expected to reflect the new value via props eventually.
    } catch (err) {
      // Revert on failure
      setDisplayValue(startValue);
      // eslint-disable-next-line no-console
      console.error("InlineEditableText save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, saving]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    }
  };

  const handleBlur = () => {
    if (!isEditing) return;
    void commitEdit();
  };

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        minWidth: 0,
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={saving}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            padding: "2px 4px",
            fontSize: "inherit",
            fontFamily: "inherit",
            background: "#fff",
            minWidth: 40,
          }}
        />
      ) : (
        <>
          <span
            style={{
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayValue}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#9ca3af",
              cursor: "pointer",
            }}
            title="Edit"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEdit();
            }}
          >
            ✎
          </span>
        </>
      )}
    </span>
  );
}

