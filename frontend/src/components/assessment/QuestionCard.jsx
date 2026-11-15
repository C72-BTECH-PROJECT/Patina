import React from 'react';

// R-17: one served question. Multiple choice saves on click; short answers are
// debounced by the page. Only the fields of questionView() are rendered.
function QuestionCard({ index, question, value, onChoose, onType, disabled }) {
  const { question_id: id, question_type: type, skill } = question;
  return (
    <div
      className="card p-6"
      data-testid="assessment-question"
      data-question-id={id || ''}
      data-type={type || 'unknown'}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-caption text-muted-foreground">Question {index + 1}</span>
        {skill && <span className="badge badge-primary text-[10px]">{skill}</span>}
        <span className="badge text-[10px]">{type === 'mcq' ? 'Multiple choice' : type === 'short_answer' ? 'Short answer' : 'Unknown type'}</span>
      </div>

      <h2 className="text-body font-medium text-foreground leading-relaxed mb-4">{question.question}</h2>

      {type === 'mcq' && (
        <div className="space-y-2" role="radiogroup" aria-label={`Question ${index + 1} options`}>
          {question.options.map((opt) => {
            const selected = value === opt.label;
            return (
              <button
                key={opt.label}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid="assessment-option"
                data-label={opt.label}
                data-selected={selected ? 'true' : 'false'}
                disabled={disabled}
                onClick={() => onChoose(id, opt.label)}
                className={`flex items-start gap-3 p-3 rounded-lg border w-full text-left transition-colors disabled:opacity-60 ${
                  selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-surface hover:bg-background'
                }`}
              >
                <span className={`w-6 h-6 rounded-md border flex items-center justify-center text-caption font-semibold flex-shrink-0 ${
                  selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
                }`}>
                  {opt.label}
                </span>
                <span className="text-body-sm text-foreground">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {type === 'short_answer' && (
        <div>
          <textarea
            data-testid="assessment-short-answer"
            aria-label={`Answer to question ${index + 1}`}
            value={value || ''}
            disabled={disabled}
            onChange={(e) => onType(id, e.target.value)}
            placeholder="Type your answer here"
            rows={5}
            maxLength={10000}
            className="flex w-full rounded-md border border-input bg-surface px-3.5 min-h-[96px] py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground hover:border-foreground focus:outline-none focus:border-primary focus:shadow-focus transition-[border-color,box-shadow] duration-150 resize-y disabled:opacity-60"
          />
          <div className="text-caption text-muted-foreground mt-1">
            {(value || '').split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
      )}

      {type !== 'mcq' && type !== 'short_answer' && (
        <p className="text-body-sm text-destructive">This question has a type the page does not recognise and cannot be answered here.</p>
      )}
    </div>
  );
}

export default QuestionCard;
