package api

import (
	"fmt"
	"strings"
	"time"
)

// statsDateRangeCustom is a validated StatsDateRangeInput. A nil range, or one
// without bounds, leaves every stats query unfiltered.
type statsDateRangeCustom struct {
	from  string
	to    string
	field StatsDateField
}

func parseStatsDateRangeCustom(input *StatsDateRangeInput) (*statsDateRangeCustom, error) {
	if input == nil {
		return nil, nil
	}

	ret := &statsDateRangeCustom{field: StatsDateFieldRelease}
	if input.Field != nil && input.Field.IsValid() {
		ret.field = *input.Field
	}
	for _, bound := range []struct {
		value  *string
		target *string
		name   string
	}{
		{input.From, &ret.from, "from"},
		{input.To, &ret.to, "to"},
	} {
		if bound.value == nil || strings.TrimSpace(*bound.value) == "" {
			continue
		}
		parsed, err := time.Parse("2006-01-02", strings.TrimSpace(*bound.value))
		if err != nil {
			return nil, fmt.Errorf("invalid date range %s %q: expected YYYY-MM-DD", bound.name, *bound.value)
		}
		*bound.target = parsed.Format("2006-01-02")
	}
	if ret.from == "" && ret.to == "" {
		return nil, nil
	}
	if ret.from != "" && ret.to != "" && ret.from > ret.to {
		return nil, fmt.Errorf("invalid date range: %s is after %s", ret.from, ret.to)
	}
	return ret, nil
}

// boundsSQL returns " AND <dateExpr> >= date(?) AND <dateExpr> <= date(?)" for
// the bounds that are set. dateExpr must already evaluate to a local date.
func (r *statsDateRangeCustom) boundsSQL(dateExpr string) (string, []interface{}) {
	if r == nil {
		return "", nil
	}
	var sql strings.Builder
	var args []interface{}
	if r.from != "" {
		fmt.Fprintf(&sql, " AND %s >= date(?)", dateExpr)
		args = append(args, r.from)
	}
	if r.to != "" {
		fmt.Fprintf(&sql, " AND %s <= date(?)", dateExpr)
		args = append(args, r.to)
	}
	return sql.String(), args
}

// sceneWhereSQL filters a scenes row (sceneAlias) by the selected date field.
// O_DATE keeps scenes with at least one O inside the range.
func (r *statsDateRangeCustom) sceneWhereSQL(sceneAlias string) (string, []interface{}) {
	if r == nil {
		return "", nil
	}
	switch r.field {
	case StatsDateFieldAdded:
		return r.boundsSQL(fmt.Sprintf("date(%s.created_at, 'localtime')", sceneAlias))
	case StatsDateFieldODate:
		bounds, args := r.boundsSQL("date(range_od.o_date, 'localtime')")
		return fmt.Sprintf(`
    AND EXISTS (
      SELECT 1 FROM scenes_o_dates range_od
      WHERE range_od.scene_id = %s.id AND range_od.o_date IS NOT NULL%s
    )`, sceneAlias, bounds), args
	default:
		return r.boundsSQL(fmt.Sprintf("date(%s)", sceneOStatsEffectiveDateExpr(sceneAlias)))
	}
}

// oDateWhereSQL limits counted O events (odAlias) to the range, but only when
// the range filters by O date; release/added ranges keep all-time O counts.
func (r *statsDateRangeCustom) oDateWhereSQL(odAlias string) (string, []interface{}) {
	if r == nil || r.field != StatsDateFieldODate {
		return "", nil
	}
	return r.boundsSQL(fmt.Sprintf("date(%s.o_date, 'localtime')", odAlias))
}

// oStatsWhereSQL always filters O events by local O date for O Stats.
func (r *statsDateRangeCustom) oStatsWhereSQL(odAlias string) (string, []interface{}) {
	return r.boundsSQL(fmt.Sprintf("date(%s.o_date, 'localtime')", odAlias))
}

// endDate is the last day a gap can run to: today, or the range end if earlier.
func (r *statsDateRangeCustom) endDate(today time.Time) time.Time {
	if r == nil || r.to == "" {
		return today
	}
	end, err := time.Parse("2006-01-02", r.to)
	if err != nil || end.After(today) {
		return today
	}
	return end
}
