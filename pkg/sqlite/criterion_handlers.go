package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/stashapp/stash/pkg/models"
	"github.com/stashapp/stash/pkg/utils"
)

type criterionHandler interface {
	handle(ctx context.Context, f *filterBuilder)
}

type criterionHandlerFunc func(ctx context.Context, f *filterBuilder)

func (h criterionHandlerFunc) handle(ctx context.Context, f *filterBuilder) {
	h(ctx, f)
}

type compoundHandler []criterionHandler

func (h compoundHandler) handle(ctx context.Context, f *filterBuilder) {
	for _, h := range h {
		h.handle(ctx, f)
	}
}

// shared criterion handlers go here

func stringCriterionHandler(c *models.StringCriterionInput, column string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if modifier := c.Modifier; c.Modifier.IsValid() {
				switch modifier {
				case models.CriterionModifierIncludes:
					f.whereClauses = append(f.whereClauses, getStringSearchClause([]string{column}, c.Value, false))
				case models.CriterionModifierExcludes:
					f.whereClauses = append(f.whereClauses, getStringSearchClause([]string{column}, c.Value, true))
				case models.CriterionModifierEquals:
					f.addWhere(column+" LIKE ?", c.Value)
				case models.CriterionModifierNotEquals:
					f.addWhere(column+" NOT LIKE ?", c.Value)
				case models.CriterionModifierMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					f.addWhere(fmt.Sprintf("(%s IS NOT NULL AND %[1]s regexp ?)", column), c.Value)
				case models.CriterionModifierNotMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					f.addWhere(fmt.Sprintf("(%s IS NULL OR %[1]s NOT regexp ?)", column), c.Value)
				case models.CriterionModifierIsNull:
					f.addWhere("(" + column + " IS NULL OR TRIM(" + column + ") = '')")
				case models.CriterionModifierNotNull:
					f.addWhere("(" + column + " IS NOT NULL AND TRIM(" + column + ") != '')")
				default:
					panic("unsupported string filter modifier")
				}
			}
		}
	}
}

func joinedStringCriterionHandler(c *models.StringCriterionInput, column string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			stringCriterionHandler(c, column)(ctx, f)
		}
	}
}

func enumCriterionHandler(modifier models.CriterionModifier, values []string, column string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if modifier.IsValid() {
			switch modifier {
			case models.CriterionModifierIncludes, models.CriterionModifierEquals:
				if len(values) > 0 {
					f.whereClauses = append(f.whereClauses, getEnumSearchClause(column, values, false))
				}
			case models.CriterionModifierExcludes, models.CriterionModifierNotEquals:
				if len(values) > 0 {
					f.whereClauses = append(f.whereClauses, getEnumSearchClause(column, values, true))
				}
			case models.CriterionModifierIsNull:
				f.addWhere("(" + column + " IS NULL OR TRIM(" + column + ") = '')")
			case models.CriterionModifierNotNull:
				f.addWhere("(" + column + " IS NOT NULL AND TRIM(" + column + ") != '')")
			default:
				panic("unsupported string filter modifier")
			}
		}
	}
}

func pathCriterionHandler(c *models.StringCriterionInput, pathColumn string, basenameColumn string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			addWildcards := true
			not := false

			if modifier := c.Modifier; c.Modifier.IsValid() {
				switch modifier {
				case models.CriterionModifierIncludes:
					f.whereClauses = append(f.whereClauses, getPathSearchClauseMany(pathColumn, basenameColumn, c.Value, addWildcards, not))
				case models.CriterionModifierExcludes:
					not = true
					f.whereClauses = append(f.whereClauses, getPathSearchClauseMany(pathColumn, basenameColumn, c.Value, addWildcards, not))
				case models.CriterionModifierEquals:
					addWildcards = false
					f.whereClauses = append(f.whereClauses, getPathSearchClause(pathColumn, basenameColumn, c.Value, addWildcards, not))
				case models.CriterionModifierNotEquals:
					addWildcards = false
					not = true
					f.whereClauses = append(f.whereClauses, getPathSearchClause(pathColumn, basenameColumn, c.Value, addWildcards, not))
				case models.CriterionModifierMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					filepathColumn := fmt.Sprintf("%s || '%s' || %s", pathColumn, string(filepath.Separator), basenameColumn)
					f.addWhere(fmt.Sprintf("%s IS NOT NULL AND %s IS NOT NULL AND %s regexp ?", pathColumn, basenameColumn, filepathColumn), c.Value)
				case models.CriterionModifierNotMatchesRegex:
					if _, err := regexp.Compile(c.Value); err != nil {
						f.setError(err)
						return
					}
					filepathColumn := fmt.Sprintf("%s || '%s' || %s", pathColumn, string(filepath.Separator), basenameColumn)
					f.addWhere(fmt.Sprintf("%s IS NULL OR %s IS NULL OR %s NOT regexp ?", pathColumn, basenameColumn, filepathColumn), c.Value)
				case models.CriterionModifierIsNull:
					f.addWhere(fmt.Sprintf("%s IS NULL OR TRIM(%[1]s) = '' OR %s IS NULL OR TRIM(%[2]s) = ''", pathColumn, basenameColumn))
				case models.CriterionModifierNotNull:
					f.addWhere(fmt.Sprintf("%s IS NOT NULL AND TRIM(%[1]s) != '' AND %s IS NOT NULL AND TRIM(%[2]s) != ''", pathColumn, basenameColumn))
				default:
					panic("unsupported string filter modifier")
				}
			}
		}
	}
}

func getPathSearchClause(pathColumn, basenameColumn, p string, addWildcards, not bool) sqlClause {
	if addWildcards {
		p = "%" + p + "%"
	}

	filepathColumn := fmt.Sprintf("%s || '%s' || %s", pathColumn, string(filepath.Separator), basenameColumn)
	ret := makeClause(fmt.Sprintf("%s LIKE ?", filepathColumn), p)

	if not {
		ret = ret.not()
	}

	return ret
}

// getPathSearchClauseMany splits the query string p on whitespace
// Used for backwards compatibility for the includes/excludes modifiers
func getPathSearchClauseMany(pathColumn, basenameColumn, p string, addWildcards, not bool) sqlClause {
	q := strings.TrimSpace(p)
	trimmedQuery := strings.Trim(q, "\"")

	if trimmedQuery == q {
		q = regexp.MustCompile(`\s+`).ReplaceAllString(q, " ")
		queryWords := strings.Split(q, " ")

		var ret []sqlClause
		// Search for any word
		for _, word := range queryWords {
			ret = append(ret, getPathSearchClause(pathColumn, basenameColumn, word, addWildcards, not))
		}

		if !not {
			return orClauses(ret...)
		}

		return andClauses(ret...)
	}

	return getPathSearchClause(pathColumn, basenameColumn, trimmedQuery, addWildcards, not)
}

func intCriterionHandler(c *models.IntCriterionInput, column string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			clause, args := getIntCriterionWhereClause(column, *c)
			f.addWhere(clause, args...)
		}
	}
}

func floatCriterionHandler(c *models.FloatCriterionInput, column string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			clause, args := getFloatCriterionWhereClause(column, *c)
			f.addWhere(clause, args...)
		}
	}
}

func floatIntCriterionHandler(durationFilter *models.IntCriterionInput, column string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if durationFilter != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			clause, args := getIntCriterionWhereClause("cast("+column+" as int)", *durationFilter)
			f.addWhere(clause, args...)
		}
	}
}

func boolCriterionHandler(c *bool, column string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}
			var v string
			if *c {
				v = "1"
			} else {
				v = "0"
			}

			f.addWhere(column + " = " + v)
		}
	}
}

type dateCriterionHandler struct {
	c      *models.DateCriterionInput
	column string
	joinFn func(f *filterBuilder)
}

func (h *dateCriterionHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.c != nil {
		if h.joinFn != nil {
			h.joinFn(f)
		}
		clause, args := getDateCriterionWhereClause(h.column, *h.c)
		f.addWhere(clause, args...)
	}
}

type timestampCriterionHandler struct {
	c      *models.TimestampCriterionInput
	column string
	joinFn func(f *filterBuilder)
}

func (h *timestampCriterionHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.c != nil {
		if h.joinFn != nil {
			h.joinFn(f)
		}
		clause, args := getTimestampCriterionWhereClause(h.column, *h.c)
		f.addWhere(clause, args...)
	}
}

func yearFilterCriterionHandler(year *models.IntCriterionInput, col string) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if year != nil && year.Modifier.IsValid() {
			clause, args := getIntCriterionWhereClause("cast(strftime('%Y', "+col+") as int)", *year)
			f.addWhere(clause, args...)
		}
	}
}

func resolutionCriterionHandler(resolution *models.ResolutionCriterionInput, heightColumn string, widthColumn string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if resolution != nil && resolution.Value.IsValid() {
			if addJoinFn != nil {
				addJoinFn(f)
			}

			mn := resolution.Value.GetMinResolution()
			mx := resolution.Value.GetMaxResolution()

			widthHeight := fmt.Sprintf("MIN(%s, %s)", widthColumn, heightColumn)

			switch resolution.Modifier {
			case models.CriterionModifierEquals:
				f.addWhere(fmt.Sprintf("%s BETWEEN %d AND %d", widthHeight, mn, mx))
			case models.CriterionModifierNotEquals:
				f.addWhere(fmt.Sprintf("%s NOT BETWEEN %d AND %d", widthHeight, mn, mx))
			case models.CriterionModifierLessThan:
				f.addWhere(fmt.Sprintf("%s < %d", widthHeight, mn))
			case models.CriterionModifierGreaterThan:
				f.addWhere(fmt.Sprintf("%s > %d", widthHeight, mx))
			}
		}
	}
}

func orientationCriterionHandler(orientation *models.OrientationCriterionInput, heightColumn string, widthColumn string, addJoinFn func(f *filterBuilder)) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if orientation != nil {
			if addJoinFn != nil {
				addJoinFn(f)
			}

			var clauses []sqlClause

			for _, v := range orientation.Value {
				// width mod height
				mod := ""
				switch v {
				case models.OrientationPortrait:
					mod = "<"
				case models.OrientationLandscape:
					mod = ">"
				case models.OrientationSquare:
					mod = "="
				}

				if mod != "" {
					clauses = append(clauses, makeClause(fmt.Sprintf("%s %s %s", widthColumn, mod, heightColumn)))
				}
			}

			if len(clauses) > 0 {
				f.whereClauses = append(f.whereClauses, orClauses(clauses...))
			}
		}
	}
}

// handle for MultiCriterion where there is a join table between the new
// objects
type joinedMultiCriterionHandlerBuilder struct {
	// table containing the primary objects
	primaryTable string
	// table joining primary and foreign objects
	joinTable string
	// alias for join table, if required
	joinAs string
	// foreign key of the primary object on the join table
	primaryFK string
	// foreign key of the foreign object on the join table
	foreignFK string

	addJoinTable func(f *filterBuilder)
}

func (m *joinedMultiCriterionHandlerBuilder) handler(c *models.MultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			// make local copy so we can modify it
			criterion := *c

			joinAlias := m.joinAs
			if joinAlias == "" {
				joinAlias = m.joinTable
			}

			if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if criterion.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				m.addJoinTable(f)

				f.addWhere(utils.StrFormat("{table}.{column} IS {not} NULL", utils.StrFormatMap{
					"table":  joinAlias,
					"column": m.foreignFK,
					"not":    notClause,
				}))
				return
			}

			if len(criterion.Value) == 0 && len(criterion.Excludes) == 0 {
				return
			}

			// combine excludes if excludes modifier is selected
			if criterion.Modifier == models.CriterionModifierExcludes {
				criterion.Modifier = models.CriterionModifierIncludesAll
				criterion.Excludes = append(criterion.Excludes, criterion.Value...)
				criterion.Value = nil
			}

			if len(criterion.Value) > 0 {
				whereClause := ""
				havingClause := ""

				var args []interface{}
				for _, tagID := range criterion.Value {
					args = append(args, tagID)
				}

				switch criterion.Modifier {
				case models.CriterionModifierIncludes:
					// includes any of the provided ids
					m.addJoinTable(f)
					whereClause = fmt.Sprintf("%s.%s IN %s", joinAlias, m.foreignFK, getInBinding(len(criterion.Value)))
				case models.CriterionModifierEquals:
					// includes only the provided ids
					m.addJoinTable(f)
					whereClause = utils.StrFormat("{joinAlias}.{foreignFK} IN {inBinding} AND (SELECT COUNT(*) FROM {joinTable} s WHERE s.{primaryFK} = {primaryTable}.id) = ?", utils.StrFormatMap{
						"joinAlias":    joinAlias,
						"foreignFK":    m.foreignFK,
						"inBinding":    getInBinding(len(criterion.Value)),
						"joinTable":    m.joinTable,
						"primaryFK":    m.primaryFK,
						"primaryTable": m.primaryTable,
					})
					havingClause = fmt.Sprintf("count(distinct %s.%s) IS %d", joinAlias, m.foreignFK, len(criterion.Value))
					args = append(args, len(criterion.Value))
				case models.CriterionModifierNotEquals:
					f.setError(fmt.Errorf("not equals modifier is not supported for multi criterion input"))
				case models.CriterionModifierIncludesAll:
					// includes all of the provided ids
					m.addJoinTable(f)
					whereClause = fmt.Sprintf("%s.%s IN %s", joinAlias, m.foreignFK, getInBinding(len(criterion.Value)))
					havingClause = fmt.Sprintf("count(distinct %s.%s) IS %d", joinAlias, m.foreignFK, len(criterion.Value))
				}

				f.addWhere(whereClause, args...)
				f.addHaving(havingClause)
			}

			if len(criterion.Excludes) > 0 {
				var args []interface{}
				for _, tagID := range criterion.Excludes {
					args = append(args, tagID)
				}

				// excludes all of the provided ids
				// need to use actual join table name for this
				// <primaryTable>.id NOT IN (select <joinTable>.<primaryFK> from <joinTable> where <joinTable>.<foreignFK> in <values>)
				whereClause := fmt.Sprintf("%[1]s.id NOT IN (SELECT %[3]s.%[2]s from %[3]s where %[3]s.%[4]s in %[5]s)", m.primaryTable, m.primaryFK, m.joinTable, m.foreignFK, getInBinding(len(criterion.Excludes)))

				f.addWhere(whereClause, args...)
			}
		}
	}
}

type multiCriterionHandlerBuilder struct {
	primaryTable string
	foreignTable string
	joinTable    string
	primaryFK    string
	foreignFK    string

	// function that will be called to perform any necessary joins
	addJoinsFunc func(f *filterBuilder)
}

func (m *multiCriterionHandlerBuilder) handler(criterion *models.MultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if criterion.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				table := m.primaryTable
				if m.joinTable != "" {
					table = m.joinTable
					f.addLeftJoin(table, "", fmt.Sprintf("%s.%s = %s.id", table, m.primaryFK, m.primaryTable))
				}

				f.addWhere(fmt.Sprintf("%s.%s IS %s NULL", table, m.foreignFK, notClause))
				return
			}

			if len(criterion.Value) == 0 {
				return
			}

			var args []interface{}
			for _, tagID := range criterion.Value {
				args = append(args, tagID)
			}

			if m.addJoinsFunc != nil {
				m.addJoinsFunc(f)
			}

			whereClause, havingClause := getMultiCriterionClause(m.primaryTable, m.foreignTable, m.joinTable, m.primaryFK, m.foreignFK, criterion)
			f.addWhere(whereClause, args...)
			f.addHaving(havingClause)
		}
	}
}

type countCriterionHandlerBuilder struct {
	primaryTable string
	joinTable    string
	primaryFK    string
}

func (m *countCriterionHandlerBuilder) handler(criterion *models.IntCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			clause, args := getCountCriterionClause(m.primaryTable, m.joinTable, m.primaryFK, *criterion)

			f.addWhere(clause, args...)
		}
	}
}

// handler for StringCriterion for string list fields
type stringListCriterionHandlerBuilder struct {
	primaryTable string
	// foreign key of the primary object on the join table
	primaryFK string
	// table joining primary and foreign objects
	joinTable string
	// string field on the join table
	stringColumn string

	addJoinTable   func(f *filterBuilder)
	excludeHandler func(f *filterBuilder, criterion *models.StringCriterionInput)
}

func (m *stringListCriterionHandlerBuilder) handler(criterion *models.StringCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if criterion != nil {
			if criterion.Modifier == models.CriterionModifierExcludes {
				// special handling for excludes
				if m.excludeHandler != nil {
					m.excludeHandler(f, criterion)
					return
				}

				// excludes all of the provided values
				// need to use actual join table name for this
				// <primaryTable>.id NOT IN (select <joinTable>.<primaryFK> from <joinTable> where <joinTable>.<foreignFK> in <values>)
				whereClause := utils.StrFormat("{primaryTable}.id NOT IN (SELECT {joinTable}.{primaryFK} from {joinTable} where {joinTable}.{stringColumn} LIKE ?)",
					utils.StrFormatMap{
						"primaryTable": m.primaryTable,
						"joinTable":    m.joinTable,
						"primaryFK":    m.primaryFK,
						"stringColumn": m.stringColumn,
					},
				)

				f.addWhere(whereClause, "%"+criterion.Value+"%")

				// TODO - should we also exclude null values?
				// m.addJoinTable(f)
				// stringCriterionHandler(&models.StringCriterionInput{
				// 	Modifier: models.CriterionModifierNotNull,
				// }, m.joinTable+"."+m.stringColumn)(ctx, f)
			} else {
				m.addJoinTable(f)
				stringCriterionHandler(criterion, m.joinTable+"."+m.stringColumn)(ctx, f)
			}
		}
	}
}

func studioCriterionHandler(primaryTable string, studios *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if studios == nil {
			return
		}

		studiosCopy := *studios
		switch studiosCopy.Modifier {
		case models.CriterionModifierEquals:
			studiosCopy.Modifier = models.CriterionModifierIncludesAll
		case models.CriterionModifierNotEquals:
			studiosCopy.Modifier = models.CriterionModifierExcludes
		}

		hh := hierarchicalMultiCriterionHandlerBuilder{
			primaryTable: primaryTable,
			foreignTable: studioTable,
			foreignFK:    studioIDColumn,
			parentFK:     "parent_id",
		}

		hh.handler(&studiosCopy)(ctx, f)
	}
}

type hierarchicalMultiCriterionHandlerBuilder struct {
	primaryTable string
	foreignTable string
	foreignFK    string

	parentFK       string
	childFK        string
	relationsTable string
}

func getHierarchicalValues(ctx context.Context, values []string, table, relationsTable, parentFK string, childFK string, depth *int) (string, error) {
	var args []interface{}

	if parentFK == "" {
		parentFK = "parent_id"
	}
	if childFK == "" {
		childFK = "child_id"
	}

	depthVal := 0
	if depth != nil {
		depthVal = *depth
	}

	if depthVal == 0 {
		valid := true
		var valuesClauses []string
		for _, value := range values {
			id, err := strconv.Atoi(value)
			// In case of invalid value just run the query.
			// Building VALUES() based on provided values just saves a query when depth is 0.
			if err != nil {
				valid = false
				break
			}

			valuesClauses = append(valuesClauses, fmt.Sprintf("(%d,%d)", id, id))
		}

		if valid {
			return "VALUES" + strings.Join(valuesClauses, ","), nil
		}
	}

	for _, value := range values {
		args = append(args, value)
	}
	inCount := len(args)

	var depthCondition string
	if depthVal != -1 {
		depthCondition = fmt.Sprintf("WHERE depth < %d", depthVal)
	}

	withClauseMap := utils.StrFormatMap{
		"table":           table,
		"relationsTable":  relationsTable,
		"inBinding":       getInBinding(inCount),
		"recursiveSelect": "",
		"parentFK":        parentFK,
		"childFK":         childFK,
		"depthCondition":  depthCondition,
		"unionClause":     "",
	}

	if relationsTable != "" {
		withClauseMap["recursiveSelect"] = utils.StrFormat(`SELECT p.root_id, c.{childFK}, depth + 1 FROM {relationsTable} AS c
INNER JOIN items as p ON c.{parentFK} = p.item_id
`, withClauseMap)
	} else {
		withClauseMap["recursiveSelect"] = utils.StrFormat(`SELECT p.root_id, c.id, depth + 1 FROM {table} as c
INNER JOIN items as p ON c.{parentFK} = p.item_id
`, withClauseMap)
	}

	if depthVal != 0 {
		withClauseMap["unionClause"] = utils.StrFormat(`
UNION {recursiveSelect} {depthCondition}
`, withClauseMap)
	}

	withClause := utils.StrFormat(`items AS (
SELECT id as root_id, id as item_id, 0 as depth FROM {table}
WHERE id in {inBinding}
{unionClause})
`, withClauseMap)

	query := fmt.Sprintf("WITH RECURSIVE %s SELECT 'VALUES' || GROUP_CONCAT('(' || root_id || ', ' || item_id || ')') AS val FROM items", withClause)

	var valuesClause sql.NullString
	err := dbWrapper.Get(ctx, &valuesClause, query, args...)
	if err != nil {
		return "", fmt.Errorf("failed to get hierarchical values: %w", err)
	}

	// if no values are found, just return a values string with the values only
	if !valuesClause.Valid {
		for i, value := range values {
			values[i] = fmt.Sprintf("(%s, %s)", value, value)
		}
		valuesClause.String = "VALUES" + strings.Join(values, ",")
	}

	return valuesClause.String, nil
}

func addHierarchicalConditionClauses(f *filterBuilder, criterion models.HierarchicalMultiCriterionInput, table, idColumn string) {
	switch criterion.Modifier {
	case models.CriterionModifierIncludes:
		f.addWhere(fmt.Sprintf("%s.%s IS NOT NULL", table, idColumn))
	case models.CriterionModifierIncludesAll:
		f.addWhere(fmt.Sprintf("%s.%s IS NOT NULL", table, idColumn))
		f.addHaving(fmt.Sprintf("count(distinct %s.%s) IS %d", table, idColumn, len(criterion.Value)))
	case models.CriterionModifierExcludes:
		f.addWhere(fmt.Sprintf("%s.%s IS NULL", table, idColumn))
	}
}

func (m *hierarchicalMultiCriterionHandlerBuilder) handler(c *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			// make a copy so we don't modify the original
			criterion := *c

			// don't support equals/not equals
			if criterion.Modifier == models.CriterionModifierEquals || criterion.Modifier == models.CriterionModifierNotEquals {
				f.setError(fmt.Errorf("modifier %s is not supported for hierarchical multi criterion", criterion.Modifier))
				return
			}

			if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if criterion.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				f.addWhere(utils.StrFormat("{table}.{column} IS {not} NULL", utils.StrFormatMap{
					"table":  m.primaryTable,
					"column": m.foreignFK,
					"not":    notClause,
				}))
				return
			}

			if len(criterion.Value) == 0 && len(criterion.Excludes) == 0 {
				return
			}

			// combine excludes if excludes modifier is selected
			if criterion.Modifier == models.CriterionModifierExcludes {
				criterion.Modifier = models.CriterionModifierIncludesAll
				criterion.Excludes = append(criterion.Excludes, criterion.Value...)
				criterion.Value = nil
			}

			if len(criterion.Value) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, criterion.Value, m.foreignTable, m.relationsTable, m.parentFK, m.childFK, criterion.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				switch criterion.Modifier {
				case models.CriterionModifierIncludes:
					f.addWhere(fmt.Sprintf("%s.%s IN (SELECT column2 FROM (%s))", m.primaryTable, m.foreignFK, valuesClause))
				case models.CriterionModifierIncludesAll:
					f.addWhere(fmt.Sprintf("%s.%s IN (SELECT column2 FROM (%s))", m.primaryTable, m.foreignFK, valuesClause))
					f.addHaving(fmt.Sprintf("count(distinct %s.%s) IS %d", m.primaryTable, m.foreignFK, len(criterion.Value)))
				}
			}

			if len(criterion.Excludes) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, criterion.Excludes, m.foreignTable, m.relationsTable, m.parentFK, m.childFK, criterion.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				f.addWhere(fmt.Sprintf("%s.%s NOT IN (SELECT column2 FROM (%s)) OR %[1]s.%[2]s IS NULL", m.primaryTable, m.foreignFK, valuesClause))
			}
		}
	}
}

type joinedHierarchicalMultiCriterionHandlerBuilder struct {
	primaryTable string
	primaryKey   string
	foreignTable string
	foreignFK    string

	parentFK       string
	childFK        string
	relationsTable string

	joinAs    string
	joinTable string
	primaryFK string
}

func (m *joinedHierarchicalMultiCriterionHandlerBuilder) addHierarchicalConditionClauses(f *filterBuilder, criterion models.HierarchicalMultiCriterionInput, table, idColumn string) {
	primaryKey := m.primaryKey
	if primaryKey == "" {
		primaryKey = "id"
	}

	switch criterion.Modifier {
	case models.CriterionModifierEquals:
		// includes only the provided ids
		f.addWhere(fmt.Sprintf("%s.%s IS NOT NULL", table, idColumn))
		f.addHaving(fmt.Sprintf("count(distinct %s.%s) IS %d", table, idColumn, len(criterion.Value)))
		f.addWhere(utils.StrFormat("(SELECT COUNT(*) FROM {joinTable} s WHERE s.{primaryFK} = {primaryTable}.{primaryKey}) = ?", utils.StrFormatMap{
			"joinTable":    m.joinTable,
			"primaryFK":    m.primaryFK,
			"primaryTable": m.primaryTable,
			"primaryKey":   primaryKey,
		}), len(criterion.Value))
	case models.CriterionModifierNotEquals:
		f.setError(fmt.Errorf("not equals modifier is not supported for hierarchical multi criterion input"))
	default:
		addHierarchicalConditionClauses(f, criterion, table, idColumn)
	}
}

func (m *joinedHierarchicalMultiCriterionHandlerBuilder) handler(c *models.HierarchicalMultiCriterionInput) criterionHandlerFunc {
	return func(ctx context.Context, f *filterBuilder) {
		if c != nil {
			// make a copy so we don't modify the original
			criterion := *c
			joinAlias := m.joinAs
			primaryKey := m.primaryKey
			if primaryKey == "" {
				primaryKey = "id"
			}

			if criterion.Modifier == models.CriterionModifierEquals && criterion.Depth != nil && *criterion.Depth != 0 {
				f.setError(fmt.Errorf("depth is not supported for equals modifier in hierarchical multi criterion input"))
				return
			}

			if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
				var notClause string
				if criterion.Modifier == models.CriterionModifierNotNull {
					notClause = "NOT"
				}

				f.addLeftJoin(m.joinTable, joinAlias, fmt.Sprintf("%s.%s = %s.%s", joinAlias, m.primaryFK, m.primaryTable, primaryKey))

				f.addWhere(utils.StrFormat("{table}.{column} IS {not} NULL", utils.StrFormatMap{
					"table":  joinAlias,
					"column": m.foreignFK,
					"not":    notClause,
				}))
				return
			}

			// combine excludes if excludes modifier is selected
			if criterion.Modifier == models.CriterionModifierExcludes {
				criterion.Modifier = models.CriterionModifierIncludesAll
				criterion.Excludes = append(criterion.Excludes, criterion.Value...)
				criterion.Value = nil
			}

			if len(criterion.Value) == 0 && len(criterion.Excludes) == 0 {
				return
			}

			if len(criterion.Value) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, criterion.Value, m.foreignTable, m.relationsTable, m.parentFK, m.childFK, criterion.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				joinTable := utils.StrFormat(`(
		SELECT j.*, d.column1 AS root_id, d.column2 AS item_id FROM {joinTable} AS j
		INNER JOIN ({valuesClause}) AS d ON j.{foreignFK} = d.column2
	)
	`, utils.StrFormatMap{
					"joinTable":    m.joinTable,
					"foreignFK":    m.foreignFK,
					"valuesClause": valuesClause,
				})

				f.addLeftJoin(joinTable, joinAlias, fmt.Sprintf("%s.%s = %s.%s", joinAlias, m.primaryFK, m.primaryTable, primaryKey))

				m.addHierarchicalConditionClauses(f, criterion, joinAlias, "root_id")
			}

			if len(criterion.Excludes) > 0 {
				valuesClause, err := getHierarchicalValues(ctx, criterion.Excludes, m.foreignTable, m.relationsTable, m.parentFK, m.childFK, criterion.Depth)
				if err != nil {
					f.setError(err)
					return
				}

				joinTable := utils.StrFormat(`(
		SELECT j2.*, e.column1 AS root_id, e.column2 AS item_id FROM {joinTable} AS j2
		INNER JOIN ({valuesClause}) AS e ON j2.{foreignFK} = e.column2
	)
	`, utils.StrFormatMap{
					"joinTable":    m.joinTable,
					"foreignFK":    m.foreignFK,
					"valuesClause": valuesClause,
				})

				joinAlias2 := joinAlias + "2"

				f.addLeftJoin(joinTable, joinAlias2, fmt.Sprintf("%s.%s = %s.%s", joinAlias2, m.primaryFK, m.primaryTable, primaryKey))

				// modify for exclusion
				criterionCopy := criterion
				criterionCopy.Modifier = models.CriterionModifierExcludes
				criterionCopy.Value = c.Excludes

				m.addHierarchicalConditionClauses(f, criterionCopy, joinAlias2, "root_id")
			}
		}
	}
}

type joinedPerformerTagsHandler struct {
	criterion *models.HierarchicalMultiCriterionInput

	primaryTable   string // eg scenes
	joinTable      string // eg performers_scenes
	joinPrimaryKey string // eg scene_id
}

func (h *joinedPerformerTagsHandler) handle(ctx context.Context, f *filterBuilder) {
	tags := h.criterion

	if tags != nil {
		criterion := tags.CombineExcludes()

		// validate the modifier
		switch criterion.Modifier {
		case models.CriterionModifierIncludesAll, models.CriterionModifierIncludes, models.CriterionModifierExcludes, models.CriterionModifierIsNull, models.CriterionModifierNotNull:
			// valid
		default:
			f.setError(fmt.Errorf("invalid modifier %s for performer tags", criterion.Modifier))
		}

		strFormatMap := utils.StrFormatMap{
			"primaryTable":   h.primaryTable,
			"joinTable":      h.joinTable,
			"joinPrimaryKey": h.joinPrimaryKey,
			"inBinding":      getInBinding(len(criterion.Value)),
		}

		if criterion.Modifier == models.CriterionModifierIsNull || criterion.Modifier == models.CriterionModifierNotNull {
			var notClause string
			if criterion.Modifier == models.CriterionModifierNotNull {
				notClause = "NOT"
			}

			f.addLeftJoin(h.joinTable, "", utils.StrFormat("{primaryTable}.id = {joinTable}.{joinPrimaryKey}", strFormatMap))
			f.addLeftJoin("performers_tags", "", utils.StrFormat("{joinTable}.performer_id = performers_tags.performer_id", strFormatMap))

			f.addWhere(fmt.Sprintf("performers_tags.tag_id IS %s NULL", notClause))
			return
		}

		if len(criterion.Value) == 0 && len(criterion.Excludes) == 0 {
			return
		}

		if len(criterion.Value) > 0 {
			valuesClause, err := getHierarchicalValues(ctx, criterion.Value, tagTable, "tags_relations", "", "", criterion.Depth)
			if err != nil {
				f.setError(err)
				return
			}

			f.addWith(utils.StrFormat(`performer_tags AS (
SELECT ps.{joinPrimaryKey} as primaryID, t.column1 AS root_tag_id FROM {joinTable} ps
INNER JOIN performers_tags pt ON pt.performer_id = ps.performer_id
INNER JOIN (`+valuesClause+`) t ON t.column2 = pt.tag_id
)`, strFormatMap))

			f.addLeftJoin("performer_tags", "", utils.StrFormat("performer_tags.primaryID = {primaryTable}.id", strFormatMap))

			addHierarchicalConditionClauses(f, criterion, "performer_tags", "root_tag_id")
		}

		if len(criterion.Excludes) > 0 {
			valuesClause, err := getHierarchicalValues(ctx, criterion.Excludes, tagTable, "tags_relations", "", "", criterion.Depth)
			if err != nil {
				f.setError(err)
				return
			}

			clause := utils.StrFormat("{primaryTable}.id NOT IN (SELECT {joinTable}.{joinPrimaryKey} FROM {joinTable} INNER JOIN performers_tags ON {joinTable}.performer_id = performers_tags.performer_id WHERE performers_tags.tag_id IN (SELECT column2 FROM (%s)))", strFormatMap)
			f.addWhere(fmt.Sprintf(clause, valuesClause))
		}
	}
}

type joinedSceneMarkerTagsHandler struct {
	criterion *models.SceneMarkerTagsCriterionInput

	primaryTable   string // eg scenes
	joinTable      string // eg scene_markers
	joinPrimaryKey string // eg scene_id
}

func (h *joinedSceneMarkerTagsHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.criterion == nil {
		return
	}

	// Always join the scene_markers table for consistency with other handlers
	f.addLeftJoin(h.joinTable, "", utils.StrFormat("{primaryTable}.id = {joinTable}.{joinPrimaryKey}", utils.StrFormatMap{
		"primaryTable":   h.primaryTable,
		"joinTable":      h.joinTable,
		"joinPrimaryKey": h.joinPrimaryKey,
	}))

	c := h.criterion

	// helper to expand ethnicity like global filters for consistency
	expandEthnicity := func(s string) []string {
		v := strings.TrimSpace(s)
		if v == "" {
			return nil
		}
		out := []string{v}
		if strings.EqualFold(v, "Black") {
			out = append(out, "Mixed", "Afrolatino")
		}
		if strings.EqualFold(v, "White") {
			out = append(out, "Mixed")
		}
		if strings.EqualFold(v, "Latino") {
			out = append(out, "Afrolatino")
		}
		return out
	}

	// helper to expand multiple ethnicities
	expandEthnicities := func(ethnicities []string) []string {
		var out []string
		seen := make(map[string]bool)
		for _, e := range ethnicities {
			for _, exp := range expandEthnicity(e) {
				if !seen[exp] {
					seen[exp] = true
					out = append(out, exp)
				}
			}
		}
		return out
	}

	switch c.Modifier {
	case models.CriterionModifierIsNull, models.CriterionModifierNotNull:
		var notClause string
		if c.Modifier == models.CriterionModifierNotNull {
			notClause = "NOT"
		}
		// Join marker tags to check presence/absence
		f.addLeftJoin("scene_markers_tags", "", "scene_markers.id = scene_markers_tags.scene_marker_id")
		f.addWhere(fmt.Sprintf("scene_markers_tags.tag_id IS %s NULL", notClause))
		return

	case models.CriterionModifierEquals:
		// Check if GroupsExtended is provided (with performer attributes)
		if len(c.GroupsExtended) > 0 {
			// Group identical configurations to enforce uniqueness:
			// If there are 5 identical groups (e.g., 5 groups with just "facial" tag),
			// we need to find 5 DISTINCT markers matching that configuration.

			// Helper to create a canonical key for a group configuration
			type groupConfig struct {
				tagIDs                     []string
				depth                      int
				performerMode              string
				topPerformerIDs            []string
				topAnyCount                int // Minimum number of ANY top performers required
				topEthnicities             []string
				topCountries               []string
				topRating                  string                                  // serialized IntCriterionInput
				topUnnamedPerformers       []models.UnnamedPerformerCriterionInput // Unnamed performers for top role
				bottomPerformerIDs         []string
				bottomAnyCount             int // Minimum number of ANY bottom performers required
				bottomEthnicities          []string
				bottomCountries            []string
				bottomRating               string
				bottomUnnamedPerformers    []models.UnnamedPerformerCriterionInput // Unnamed performers for bottom role
				bothRolesPerformerIDs      []string
				bothRolesEthnicities       []string
				bothRolesCountries         []string
				bothRolesRating            string
				bothRolesUnnamedPerformers []models.UnnamedPerformerCriterionInput // Unnamed performers for both roles
				excludeTagIDs              []string
			}

			serializeRating := func(r *models.IntCriterionInput) string {
				if r == nil {
					return ""
				}
				v2 := ""
				if r.Value2 != nil {
					v2 = fmt.Sprintf("%d", *r.Value2)
				}
				return fmt.Sprintf("%s:%d:%s", r.Modifier, r.Value, v2)
			}

			makeGroupKey := func(g models.SceneMarkerTagGroupInput) groupConfig {
				cfg := groupConfig{
					tagIDs:        append([]string(nil), g.TagIDs...),
					excludeTagIDs: append([]string(nil), g.ExcludeTagIDs...),
					performerMode: "OR", // default
				}
				if g.Depth != nil {
					cfg.depth = *g.Depth
				}
				if g.PerformerMode != nil {
					cfg.performerMode = *g.PerformerMode
				}

				// Top performer fields (use new fields, fall back to deprecated)
				cfg.topPerformerIDs = append([]string(nil), g.TopPerformerIDs...)
				if g.TopAnyCount != nil {
					cfg.topAnyCount = *g.TopAnyCount
				}
				cfg.topEthnicities = append([]string(nil), g.TopEthnicities...)
				cfg.topCountries = append([]string(nil), g.TopCountries...)
				cfg.topRating = serializeRating(g.TopRating)
				if len(cfg.topEthnicities) == 0 && len(g.PerformerEthnicities) > 0 {
					cfg.topEthnicities = append([]string(nil), g.PerformerEthnicities...)
				}
				if len(cfg.topCountries) == 0 && len(g.PerformerCountries) > 0 {
					cfg.topCountries = append([]string(nil), g.PerformerCountries...)
				}
				if cfg.topRating == "" && g.PerformerRating != nil {
					cfg.topRating = serializeRating(g.PerformerRating)
				}

				// Bottom performer fields (use new fields, fall back to deprecated)
				cfg.bottomPerformerIDs = append([]string(nil), g.BottomPerformerIDs...)
				if g.BottomAnyCount != nil {
					cfg.bottomAnyCount = *g.BottomAnyCount
				}
				cfg.bottomEthnicities = append([]string(nil), g.BottomEthnicities...)
				cfg.bottomCountries = append([]string(nil), g.BottomCountries...)
				cfg.bottomRating = serializeRating(g.BottomRating)
				if len(cfg.bottomEthnicities) == 0 && len(g.PerformerEthnicities) > 0 {
					cfg.bottomEthnicities = append([]string(nil), g.PerformerEthnicities...)
				}
				if len(cfg.bottomCountries) == 0 && len(g.PerformerCountries) > 0 {
					cfg.bottomCountries = append([]string(nil), g.PerformerCountries...)
				}
				if cfg.bottomRating == "" && g.PerformerRating != nil {
					cfg.bottomRating = serializeRating(g.PerformerRating)
				}

				// Both roles performer fields
				cfg.bothRolesPerformerIDs = append([]string(nil), g.BothRolesPerformerIDs...)
				cfg.bothRolesEthnicities = append([]string(nil), g.BothRolesEthnicities...)
				cfg.bothRolesCountries = append([]string(nil), g.BothRolesCountries...)
				cfg.bothRolesRating = serializeRating(g.BothRolesRating)
				// Unnamed performers for both roles
				if len(g.BothRolesUnnamedPerformers) > 0 {
					cfg.bothRolesUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.BothRolesUnnamedPerformers))
					copy(cfg.bothRolesUnnamedPerformers, g.BothRolesUnnamedPerformers)
				}
				// Unnamed performers for top/bottom roles
				if len(g.TopUnnamedPerformers) > 0 {
					cfg.topUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.TopUnnamedPerformers))
					copy(cfg.topUnnamedPerformers, g.TopUnnamedPerformers)
				}
				if len(g.BottomUnnamedPerformers) > 0 {
					cfg.bottomUnnamedPerformers = make([]models.UnnamedPerformerCriterionInput, len(g.BottomUnnamedPerformers))
					copy(cfg.bottomUnnamedPerformers, g.BottomUnnamedPerformers)
				}

				// Sort all slices for canonical ordering
				sort.Strings(cfg.tagIDs)
				sort.Strings(cfg.excludeTagIDs)
				sort.Strings(cfg.topPerformerIDs)
				sort.Strings(cfg.topEthnicities)
				sort.Strings(cfg.topCountries)
				sort.Strings(cfg.bottomPerformerIDs)
				sort.Strings(cfg.bottomEthnicities)
				sort.Strings(cfg.bottomCountries)
				sort.Strings(cfg.bothRolesPerformerIDs)
				sort.Strings(cfg.bothRolesEthnicities)
				sort.Strings(cfg.bothRolesCountries)

				return cfg
			}

			// Group configurations by canonical key
			type groupEntry struct {
				config        groupConfig
				originalGroup models.SceneMarkerTagGroupInput
			}
			configCounts := make(map[string]int)
			configGroups := make(map[string]groupEntry)

			for _, g := range c.GroupsExtended {
				cfg := makeGroupKey(g)
				// Serialize config to string key for grouping
				keyParts := []string{
					strings.Join(cfg.tagIDs, ","),
					fmt.Sprintf("d%d", cfg.depth),
					cfg.performerMode,
					strings.Join(cfg.topPerformerIDs, ","),
					fmt.Sprintf("tac%d", cfg.topAnyCount),
					strings.Join(cfg.topEthnicities, ","),
					strings.Join(cfg.topCountries, ","),
					cfg.topRating,
					strings.Join(cfg.bottomPerformerIDs, ","),
					fmt.Sprintf("bac%d", cfg.bottomAnyCount),
					strings.Join(cfg.bottomEthnicities, ","),
					strings.Join(cfg.bottomCountries, ","),
					cfg.bottomRating,
					strings.Join(cfg.bothRolesPerformerIDs, ","),
					strings.Join(cfg.bothRolesEthnicities, ","),
					strings.Join(cfg.bothRolesCountries, ","),
					cfg.bothRolesRating,
					strings.Join(cfg.excludeTagIDs, ","),
				}
				key := strings.Join(keyParts, "|")
				configCounts[key]++
				if _, exists := configGroups[key]; !exists {
					configGroups[key] = groupEntry{config: cfg, originalGroup: g}
				}
			}

			// Now generate queries for each unique configuration
			for key, multiplicity := range configCounts {
				entry := configGroups[key]
				g := entry.originalGroup
				cfg := entry.config

				// Expand tag IDs if depth is specified (for including sub-tags)
				tagIDs := g.TagIDs
				if len(tagIDs) > 0 && g.Depth != nil && *g.Depth != 0 {
					// Use hierarchical expansion to include descendant tags
					valuesClause, err := getHierarchicalValues(ctx, tagIDs, tagTable, "tags_relations", "parent_id", "child_id", g.Depth)
					if err != nil {
						f.setError(err)
						return
					}
					// Extract just the child tag IDs from the VALUES clause using a query
					var expandedIDs []string
					expandQuery := fmt.Sprintf("SELECT DISTINCT column2 FROM (%s)", valuesClause)
					if err := dbWrapper.Select(ctx, &expandedIDs, expandQuery); err != nil {
						f.setError(err)
						return
					}
					if len(expandedIDs) > 0 {
						tagIDs = expandedIDs
					}
				}

				originalTagCount := len(g.TagIDs)
				useIncludesLogic := len(tagIDs) > originalTagCount

				// Determine performer mode
				performerModeAnd := strings.EqualFold(cfg.performerMode, "AND")

				// Helper to build role-specific condition
				type roleCondition struct {
					clause string
					args   []any
				}

				// buildRoleCondition builds a condition for a performer role
				// tableAlias: the alias for scene_marker_performers table (e.g., "smp", "smp_g", "smp_r")
				// role: the role to match ("top", "bottom"), or empty string to skip role check
				buildRoleCondition := func(tableAlias string, role string, performerIDs []string, ethnicities []string, countries []string, ratingStr string) *roleCondition {
					var clauses []string
					var args []any

					var baseClauses []string
					if role != "" {
						baseClauses = append(baseClauses, fmt.Sprintf("%s.role = '%s'", tableAlias, role))
					}

					if len(performerIDs) > 0 {
						ph := getInBinding(len(performerIDs))
						baseClauses = append(baseClauses, fmt.Sprintf("%s.performer_id IN %s", tableAlias, ph))
						for _, pid := range performerIDs {
							args = append(args, pid)
						}
					}

					if len(ethnicities) > 0 {
						expanded := expandEthnicities(ethnicities)
						ph := getInBinding(len(expanded))
						baseClauses = append(baseClauses, fmt.Sprintf("p.ethnicity IN %s", ph))
						for _, e := range expanded {
							args = append(args, e)
						}
					}

					if len(countries) > 0 {
						ph := getInBinding(len(countries))
						baseClauses = append(baseClauses, fmt.Sprintf("p.country IN %s", ph))
						for _, c := range countries {
							args = append(args, c)
						}
					}

					if ratingStr != "" {
						// Deserialize rating (format: "modifier:value:value2")
						parts := strings.Split(ratingStr, ":")
						if len(parts) >= 2 {
							modifier := models.CriterionModifier(parts[0])
							value, _ := strconv.Atoi(parts[1])
							var value2 *int
							if len(parts) == 3 && parts[2] != "" {
								v2, _ := strconv.Atoi(parts[2])
								value2 = &v2
							}
							w, wargs := getIntWhereClause("p.rating", modifier, value, value2)
							baseClauses = append(baseClauses, w)
							args = append(args, wargs...)
						}
					}

					clauses = append(clauses, "("+strings.Join(baseClauses, " AND ")+")")

					return &roleCondition{
						clause: strings.Join(clauses, " AND "),
						args:   args,
					}
				}

				// Build role conditions
				hasTopCriteria := len(cfg.topPerformerIDs) > 0 || cfg.topAnyCount > 0 || len(cfg.topEthnicities) > 0 || len(cfg.topCountries) > 0 || cfg.topRating != ""
				var topCond *roleCondition
				if hasTopCriteria && len(cfg.topPerformerIDs) > 0 {
					// Specific performer IDs specified
					topCond = buildRoleCondition("smp", "top", cfg.topPerformerIDs, cfg.topEthnicities, cfg.topCountries, cfg.topRating)
				} else if hasTopCriteria && (len(cfg.topEthnicities) > 0 || len(cfg.topCountries) > 0 || cfg.topRating != "") {
					// Ethnicity/country/rating criteria without specific IDs
					topCond = buildRoleCondition("smp", "top", nil, cfg.topEthnicities, cfg.topCountries, cfg.topRating)
				}

				hasBottomCriteria := len(cfg.bottomPerformerIDs) > 0 || cfg.bottomAnyCount > 0 || len(cfg.bottomEthnicities) > 0 || len(cfg.bottomCountries) > 0 || cfg.bottomRating != ""
				var bottomCond *roleCondition
				if hasBottomCriteria && len(cfg.bottomPerformerIDs) > 0 {
					// Specific performer IDs specified
					bottomCond = buildRoleCondition("smp", "bottom", cfg.bottomPerformerIDs, cfg.bottomEthnicities, cfg.bottomCountries, cfg.bottomRating)
				} else if hasBottomCriteria && (len(cfg.bottomEthnicities) > 0 || len(cfg.bottomCountries) > 0 || cfg.bottomRating != "") {
					// Ethnicity/country/rating criteria without specific IDs
					bottomCond = buildRoleCondition("smp", "bottom", nil, cfg.bottomEthnicities, cfg.bottomCountries, cfg.bottomRating)
				}

				hasBothRolesCriteria := len(cfg.bothRolesPerformerIDs) > 0 || len(cfg.bothRolesEthnicities) > 0 || len(cfg.bothRolesCountries) > 0 || cfg.bothRolesRating != ""
				hasBothRolesUnnamedCriteria := len(cfg.bothRolesUnnamedPerformers) > 0

				// Build the WHERE clause for matching a single marker
				var matchConditions []string
				var matchArgs []any

				// Tags condition
				if len(tagIDs) > 0 {
					tagPh := getInBinding(len(tagIDs))
					if useIncludesLogic {
						matchConditions = append(matchConditions, `(
    SELECT COUNT(*) FROM (
      SELECT sm.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
    ) tags_per_marker
    WHERE tag_id IN `+tagPh+`
  ) >= 1`)
					} else {
						matchConditions = append(matchConditions, `(
    SELECT COUNT(DISTINCT tag_id) FROM (
      SELECT sm.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
    ) tags_per_marker
    WHERE tag_id IN `+tagPh+`
  ) = `+fmt.Sprintf("%d", originalTagCount))
					}
					for _, tid := range tagIDs {
						matchArgs = append(matchArgs, tid)
					}
				}

				// Performer conditions
				if hasBothRolesCriteria {
					// Both roles: performer must be in BOTH top and bottom
					// Build conditions with correct table aliases - smp_g for top EXISTS, smp_r for bottom EXISTS
					// Skip role param since we specify role directly in WHERE clause
					bothRolesCondTop := buildRoleCondition("smp_g", "", cfg.bothRolesPerformerIDs, cfg.bothRolesEthnicities, cfg.bothRolesCountries, cfg.bothRolesRating)
					bothRolesCondBottom := buildRoleCondition("smp_r", "", cfg.bothRolesPerformerIDs, cfg.bothRolesEthnicities, cfg.bothRolesCountries, cfg.bothRolesRating)
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp_g
    JOIN performers p ON p.id = smp_g.performer_id
    WHERE smp_g.scene_marker_id = sm.id AND smp_g.role = 'top' AND `+bothRolesCondTop.clause+`
  ) AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp_r
    JOIN performers p ON p.id = smp_r.performer_id
    WHERE smp_r.scene_marker_id = sm.id AND smp_r.role = 'bottom' AND `+bothRolesCondBottom.clause+`
  )`)
					matchArgs = append(matchArgs, bothRolesCondTop.args...)
					matchArgs = append(matchArgs, bothRolesCondBottom.args...)
				}

				// Handle unnamed performers for both_roles
				// Each unnamed performer slot represents a performer that must be in BOTH top and bottom
				if hasBothRolesUnnamedCriteria {
					for i, up := range cfg.bothRolesUnnamedPerformers {
						// Build performer criteria condition (ethnicity, country, rating)
						var upConds []string
						var upArgs []any

						if len(up.Ethnicities) > 0 {
							ph := getInBinding(len(up.Ethnicities))
							upConds = append(upConds, "p_br.ethnicity IN "+ph)
							for _, e := range up.Ethnicities {
								upArgs = append(upArgs, e)
							}
						}
						if len(up.Countries) > 0 {
							ph := getInBinding(len(up.Countries))
							upConds = append(upConds, "p_br.country IN "+ph)
							for _, c := range up.Countries {
								upArgs = append(upArgs, c)
							}
						}
						if up.Rating != nil {
							w, wargs := getIntWhereClause("p_br.rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
							upConds = append(upConds, w)
							upArgs = append(upArgs, wargs...)
						}

						// If no additional criteria, just require any performer in both roles
						upCondClause := "1=1"
						if len(upConds) > 0 {
							upCondClause = strings.Join(upConds, " AND ")
						}

						// Generate unique table aliases for this unnamed performer slot
						alias := fmt.Sprintf("smp_bru%d", i)

						// Find a performer P that:
						// 1. Is in this marker as TOP
						// 2. Is in this marker as BOTTOM
						// 3. Matches the criteria (if any)
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_br ON p_br.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id
      AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = sm.id AND performer_id = %s.performer_id AND role = 'top')
      AND EXISTS (SELECT 1 FROM scene_marker_performers WHERE scene_marker_id = sm.id AND performer_id = %s.performer_id AND role = 'bottom')
      AND %s
  )`, alias, alias, alias, alias, alias, upCondClause))
						matchArgs = append(matchArgs, upArgs...)
					}
				}

				// Handle separate top/bottom unnamed performers
				// These are unnamed performer slots that are NOT in both_roles
				hasTopUnnamedCriteria := len(cfg.topUnnamedPerformers) > 0
				hasBottomUnnamedCriteria := len(cfg.bottomUnnamedPerformers) > 0

				if hasTopUnnamedCriteria || hasBottomUnnamedCriteria {
					// Build a helper to create condition for unnamed performer
					buildUnnamedCondition := func(up models.UnnamedPerformerCriterionInput, performerAlias string) (string, []any) {
						var conds []string
						var args []any

						if len(up.Ethnicities) > 0 {
							ph := getInBinding(len(up.Ethnicities))
							conds = append(conds, performerAlias+".ethnicity IN "+ph)
							for _, e := range up.Ethnicities {
								args = append(args, e)
							}
						}
						if len(up.Countries) > 0 {
							ph := getInBinding(len(up.Countries))
							conds = append(conds, performerAlias+".country IN "+ph)
							for _, c := range up.Countries {
								args = append(args, c)
							}
						}
						if up.Rating != nil {
							w, wargs := getIntWhereClause(performerAlias+".rating", up.Rating.Modifier, up.Rating.Value, up.Rating.Value2)
							conds = append(conds, w)
							args = append(args, wargs...)
						}

						if len(conds) == 0 {
							return "1=1", nil
						}
						return strings.Join(conds, " AND "), args
					}

					// Collect all performer aliases we'll use to ensure distinctness
					var topAliases []string
					var bottomAliases []string

					// Process top unnamed performers
					for i, up := range cfg.topUnnamedPerformers {
						alias := fmt.Sprintf("smp_tu%d", i)
						topAliases = append(topAliases, alias)

						cond, args := buildUnnamedCondition(up, "p_tu")
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_tu ON p_tu.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id AND %s.role = 'top' AND %s
  )`, alias, alias, alias, alias, cond))
						matchArgs = append(matchArgs, args...)
					}

					// Process bottom unnamed performers
					for i, up := range cfg.bottomUnnamedPerformers {
						alias := fmt.Sprintf("smp_bu%d", i)
						bottomAliases = append(bottomAliases, alias)

						cond, args := buildUnnamedCondition(up, "p_bu")
						matchConditions = append(matchConditions, fmt.Sprintf(`EXISTS (
    SELECT 1 FROM scene_marker_performers %s
    JOIN performers p_bu ON p_bu.id = %s.performer_id
    WHERE %s.scene_marker_id = sm.id AND %s.role = 'bottom' AND %s
  )`, alias, alias, alias, alias, cond))
						matchArgs = append(matchArgs, args...)
					}
				}

				// Ensure distinctness: count unique unnamed performer IDs across ALL slots
				// (top, bottom, and both_roles) and require at least that many distinct performers
				uniqueUnnamedIds := make(map[string]bool)
				for _, up := range cfg.topUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueUnnamedIds[*up.ID] = true
					}
				}
				for _, up := range cfg.bottomUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueUnnamedIds[*up.ID] = true
					}
				}
				for _, up := range cfg.bothRolesUnnamedPerformers {
					if up.ID != nil && *up.ID != "" {
						uniqueUnnamedIds[*up.ID] = true
					}
				}

				// If we have multiple unique unnamed performers, ensure the marker has enough distinct performers
				if len(uniqueUnnamedIds) > 1 && performerModeAnd {
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp_dist.performer_id) FROM scene_marker_performers smp_dist
    WHERE smp_dist.scene_marker_id = sm.id
  ) >= %d`, len(uniqueUnnamedIds)))
				}

				if !hasBothRolesCriteria && !hasBothRolesUnnamedCriteria && !hasTopUnnamedCriteria && !hasBottomUnnamedCriteria && topCond != nil && bottomCond != nil {
					if performerModeAnd {
						// AND: both top and bottom must exist
						matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+topCond.clause+`
  ) AND EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+bottomCond.clause+`
  )`)
						matchArgs = append(matchArgs, topCond.args...)
						matchArgs = append(matchArgs, bottomCond.args...)
					} else {
						// OR: either top or bottom
						combinedClause := fmt.Sprintf("(%s OR %s)", topCond.clause, bottomCond.clause)
						matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+combinedClause+`
  )`)
						matchArgs = append(matchArgs, topCond.args...)
						matchArgs = append(matchArgs, bottomCond.args...)
					}
				} else if topCond != nil {
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+topCond.clause+`
  )`)
					matchArgs = append(matchArgs, topCond.args...)
				} else if bottomCond != nil {
					matchConditions = append(matchConditions, `EXISTS (
    SELECT 1 FROM scene_marker_performers smp
    JOIN performers p ON p.id = smp.performer_id
    WHERE smp.scene_marker_id = sm.id AND `+bottomCond.clause+`
  )`)
					matchArgs = append(matchArgs, bottomCond.args...)
				}

				// Handle "any" count conditions (require at least N distinct performers in a role)
				// These are applied in addition to or instead of specific performer ID checks
				if cfg.topAnyCount > 0 && topCond == nil {
					// Only any count specified for tops, no specific performers
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'top'
  ) >= %d`, cfg.topAnyCount))
				} else if cfg.topAnyCount > 0 && topCond != nil {
					// Both specific performers and any count - the any count acts as a minimum
					// Already have the specific performer condition, add the count condition
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'top'
  ) >= %d`, cfg.topAnyCount))
				}

				if cfg.bottomAnyCount > 0 && bottomCond == nil {
					// Only any count specified for bottoms, no specific performers
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'bottom'
  ) >= %d`, cfg.bottomAnyCount))
				} else if cfg.bottomAnyCount > 0 && bottomCond != nil {
					// Both specific performers and any count - the any count acts as a minimum
					matchConditions = append(matchConditions, fmt.Sprintf(`(
    SELECT COUNT(DISTINCT smp.performer_id) FROM scene_marker_performers smp
    WHERE smp.scene_marker_id = sm.id AND smp.role = 'bottom'
  ) >= %d`, cfg.bottomAnyCount))
				}

				// Handle exclude-only groups (no include tags/performers, only excludes)
				if len(matchConditions) == 0 && len(cfg.excludeTagIDs) > 0 {
					// Check performer_mode to determine AND vs OR semantics
					if performerModeAnd {
						// AND mode: exclude only if scene has markers with ALL exclude tags (require each tag on distinct markers)
						// For each exclude tag, require at least one marker with that tag
						// Then use AND to combine (scene must have all of them to be excluded)
						excludeConditions := make([]string, len(cfg.excludeTagIDs))
						var excludeArgs []any
						for i, tid := range cfg.excludeTagIDs {
							excludeConditions[i] = utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm_excl`+fmt.Sprintf("%d", i)+`
WHERE sm_excl`+fmt.Sprintf("%d", i)+`.scene_id = {primaryTable}.id
  AND (
    sm_excl`+fmt.Sprintf("%d", i)+`.primary_tag_id = ?
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl`+fmt.Sprintf("%d", i)+`
      WHERE smt_excl`+fmt.Sprintf("%d", i)+`.scene_marker_id = sm_excl`+fmt.Sprintf("%d", i)+`.id AND smt_excl`+fmt.Sprintf("%d", i)+`.tag_id = ?
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
							excludeArgs = append(excludeArgs, tid, tid)
						}
						// NOT (all exist) means exclude scenes that have ALL these tags
						excludeSubq := "NOT (" + strings.Join(excludeConditions, " AND ") + ")"
						f.addWhere(excludeSubq, excludeArgs...)
					} else {
						// OR mode: exclude if scene has marker with ANY of these tags
						excludePh := getInBinding(len(cfg.excludeTagIDs))
						excludeSubq := utils.StrFormat(`NOT EXISTS (
SELECT 1 FROM scene_markers sm_excl
WHERE sm_excl.scene_id = {primaryTable}.id
  AND (
    sm_excl.primary_tag_id IN `+excludePh+`
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl
      WHERE smt_excl.scene_marker_id = sm_excl.id AND smt_excl.tag_id IN `+excludePh+`
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
						var excludeArgs []any
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						for _, tid := range cfg.excludeTagIDs {
							excludeArgs = append(excludeArgs, tid)
						}
						f.addWhere(excludeSubq, excludeArgs...)
					}
					continue
				}

				if len(matchConditions) == 0 {
					// Empty group with no excludes, skip
					continue
				}

				// Build the COUNT(DISTINCT sm.id) query
				whereClause := strings.Join(matchConditions, " AND ")
				subq := utils.StrFormat(`(
SELECT COUNT(DISTINCT sm.id)
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
  AND `+whereClause+`
) >= ?`, utils.StrFormatMap{"primaryTable": h.primaryTable})

				matchArgs = append(matchArgs, multiplicity)
				f.addWhere(subq, matchArgs...)

				// Handle exclude_tag_ids (for groups that also have include conditions)
				if len(cfg.excludeTagIDs) > 0 {
					excludePh := getInBinding(len(cfg.excludeTagIDs))
					excludeSubq := utils.StrFormat(`NOT EXISTS (
SELECT 1 FROM scene_markers sm_excl
WHERE sm_excl.scene_id = {primaryTable}.id
  AND (
    sm_excl.primary_tag_id IN `+excludePh+`
    OR EXISTS (
      SELECT 1 FROM scene_markers_tags smt_excl
      WHERE smt_excl.scene_marker_id = sm_excl.id AND smt_excl.tag_id IN `+excludePh+`
    )
  )
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
					var excludeArgs []any
					for _, tid := range cfg.excludeTagIDs {
						excludeArgs = append(excludeArgs, tid)
					}
					for _, tid := range cfg.excludeTagIDs {
						excludeArgs = append(excludeArgs, tid)
					}
					f.addWhere(excludeSubq, excludeArgs...)
				}
			}

			// Process GroupsExtendedExclude - exclude scenes with markers matching these full criteria
			if len(c.GroupsExtendedExclude) > 0 {
				// Determine AND vs OR semantics for exclude groups from ExcludeModifier
				// INCLUDES_ALL means AND (all groups must NOT exist)
				// INCLUDES means OR (any group must NOT exist - but that's the same as NOT(any exists))
				excludeAndMode := c.ExcludeModifier == nil || *c.ExcludeModifier == models.CriterionModifierIncludesAll

				var excludeGroupConditions []string
				var excludeGroupArgs []any

				for _, eg := range c.GroupsExtendedExclude {
					// Build a NOT EXISTS clause for this exclude group
					var egConditions []string
					var egArgs []any

					// Tag condition
					if len(eg.TagIDs) > 0 {
						tagPh := getInBinding(len(eg.TagIDs))
						egConditions = append(egConditions, `(
      SELECT COUNT(DISTINCT tag_id) FROM (
        SELECT sm_ex.primary_tag_id AS tag_id
        UNION ALL
        SELECT smt_ex.tag_id FROM scene_markers_tags smt_ex WHERE smt_ex.scene_marker_id = sm_ex.id
      ) tags_ex
      WHERE tag_id IN `+tagPh+`
    ) = `+fmt.Sprintf("%d", len(eg.TagIDs)))
						for _, tid := range eg.TagIDs {
							egArgs = append(egArgs, tid)
						}
					}

					// Performer conditions for exclude groups
					hasBothRolesExclude := len(eg.BothRolesPerformerIDs) > 0
					hasTopExclude := len(eg.TopPerformerIDs) > 0
					hasBottomExclude := len(eg.BottomPerformerIDs) > 0

					if hasBothRolesExclude {
						// Both roles: performer must be in BOTH top and bottom within same marker
						brPh := getInBinding(len(eg.BothRolesPerformerIDs))
						egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex_t
      WHERE smp_ex_t.scene_marker_id = sm_ex.id AND smp_ex_t.role = 'top' AND smp_ex_t.performer_id IN `+brPh+`
    ) AND EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex_b
      WHERE smp_ex_b.scene_marker_id = sm_ex.id AND smp_ex_b.role = 'bottom' AND smp_ex_b.performer_id IN `+brPh+`
    )`)
						for _, pid := range eg.BothRolesPerformerIDs {
							egArgs = append(egArgs, pid)
						}
						for _, pid := range eg.BothRolesPerformerIDs {
							egArgs = append(egArgs, pid)
						}
					} else {
						// Separate top/bottom criteria (AND mode between top and bottom)
						if hasTopExclude {
							topPh := getInBinding(len(eg.TopPerformerIDs))
							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex
      WHERE smp_ex.scene_marker_id = sm_ex.id AND smp_ex.role = 'top' AND smp_ex.performer_id IN `+topPh+`
    )`)
							for _, pid := range eg.TopPerformerIDs {
								egArgs = append(egArgs, pid)
							}
						}
						if hasBottomExclude {
							bottomPh := getInBinding(len(eg.BottomPerformerIDs))
							egConditions = append(egConditions, `EXISTS (
      SELECT 1 FROM scene_marker_performers smp_ex
      WHERE smp_ex.scene_marker_id = sm_ex.id AND smp_ex.role = 'bottom' AND smp_ex.performer_id IN `+bottomPh+`
    )`)
							for _, pid := range eg.BottomPerformerIDs {
								egArgs = append(egArgs, pid)
							}
						}
					}

					if len(egConditions) > 0 {
						// Combine all conditions with AND - marker must match ALL criteria to be excluded
						notExistsClause := utils.StrFormat(`NOT EXISTS (
  SELECT 1 FROM scene_markers sm_ex
  WHERE sm_ex.scene_id = {primaryTable}.id
    AND `+strings.Join(egConditions, `
    AND `)+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
						excludeGroupConditions = append(excludeGroupConditions, notExistsClause)
						excludeGroupArgs = append(excludeGroupArgs, egArgs...)
					}
				}

				// Combine exclude groups based on modifier
				if len(excludeGroupConditions) > 0 {
					if excludeAndMode {
						// AND mode: all exclude groups must NOT exist (each NOT EXISTS must pass)
						for i, cond := range excludeGroupConditions {
							// Calculate args for this condition by counting placeholders
							numPlaceholders := strings.Count(cond, "?")
							f.addWhere(cond, excludeGroupArgs[:numPlaceholders]...)
							if i < len(excludeGroupConditions)-1 {
								excludeGroupArgs = excludeGroupArgs[numPlaceholders:]
							}
						}
					} else {
						// OR mode: at least one exclude group must NOT exist
						// This is: NOT(EXISTS(g1) AND EXISTS(g2) AND ...) = NOT EXISTS g1 OR NOT EXISTS g2
						// For OR mode, we combine with OR
						combinedExclude := "(" + strings.Join(excludeGroupConditions, " OR ") + ")"
						f.addWhere(combinedExclude, excludeGroupArgs...)
					}
				}
			}

			return
		}

		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Group identical tag-sets and require sufficient distinct markers for each set
		type groupKey struct{ s string }
		counts := make(map[groupKey]int)
		orderedGroups := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			// build order-independent key
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			counts[key]++
			// store canonical ordered group once
			if _, ok := orderedGroups[key]; !ok {
				orderedGroups[key] = vals
			}
		}

		for k, multiplicity := range counts {
			g := orderedGroups[k]
			if len(g) == 0 {
				continue
			}
			ph := getInBinding(len(g))
			// Require at least <multiplicity> distinct markers matching the tag-set
			subq := utils.StrFormat(`(
SELECT COUNT(DISTINCT sm.id)
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
	AND (
		SELECT COUNT(DISTINCT tag_id) FROM (
			SELECT sm.primary_tag_id AS tag_id
			UNION ALL
			SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
		) tags_per_marker
		WHERE tag_id IN `+ph+`
	) = `+fmt.Sprintf("%d", len(g))+`
) >= ?`, utils.StrFormatMap{"primaryTable": h.primaryTable})

			args := make([]any, 0, len(g)+1)
			for _, v := range g {
				args = append(args, v)
			}
			args = append(args, multiplicity)
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierNotEquals:
		// Treat Value as a single group if Groups not provided
		groups := c.Groups
		if len(groups) == 0 && len(c.Value) > 0 {
			groups = [][]string{c.Value}
		}

		if len(groups) == 0 {
			// nothing to enforce
			return
		}

		// Deduplicate identical groups (order-insensitive)
		type groupKey struct{ s string }
		unique := make(map[groupKey][]string)
		for _, g := range groups {
			if len(g) == 0 {
				continue
			}
			vals := append([]string(nil), g...)
			sort.Strings(vals)
			key := groupKey{s: strings.Join(vals, ",")}
			if _, ok := unique[key]; !ok {
				unique[key] = vals
			}
		}

		// For each unique group, assert there does NOT exist a marker that contains all tags in that group
		for _, g := range unique {
			ph := getInBinding(len(g))
			subq := utils.StrFormat(`NOT EXISTS (
SELECT 1
FROM scene_markers sm
WHERE sm.scene_id = {primaryTable}.id
  AND (
    SELECT COUNT(DISTINCT tag_id) FROM (
      SELECT sm.primary_tag_id AS tag_id
      UNION ALL
      SELECT mt2.tag_id AS tag_id FROM scene_markers_tags mt2 WHERE mt2.scene_marker_id = sm.id
    ) tags_per_marker
    WHERE tag_id IN `+ph+`
  ) = `+fmt.Sprintf("%d", len(g))+`
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})

			args := make([]any, 0, len(g))
			for _, v := range g {
				args = append(args, v)
			}
			f.addWhere(subq, args...)
		}
		return

	case models.CriterionModifierIncludesAll:
		// Each tag in Value must be present on at least one marker in the scene
		if len(c.Value) == 0 {
			return
		}
		for _, v := range c.Value {
			clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id = ? OR mt.tag_id = ?)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
			f.addWhere(clause, v, v)
		}
		return

	case models.CriterionModifierIncludes:
		if len(c.Value) == 0 {
			return
		}
		ph := getInBinding(len(c.Value))
		clause := utils.StrFormat(`EXISTS (
SELECT 1 FROM scene_markers sm
LEFT JOIN scene_markers_tags mt ON mt.scene_marker_id = sm.id
WHERE sm.scene_id = {primaryTable}.id AND (sm.primary_tag_id IN `+ph+` OR mt.tag_id IN `+ph+`)
)`, utils.StrFormatMap{"primaryTable": h.primaryTable})
		args := make([]any, 0, len(c.Value)*2)
		for _, v := range c.Value {
			args = append(args, v)
		}
		for _, v := range c.Value {
			args = append(args, v)
		}
		f.addWhere(clause, args...)
		return

	default:
		// Unsupported modifiers: no-op
		return
	}
}

type stashIDCriterionHandler struct {
	c                 *models.StashIDCriterionInput
	stashIDRepository *stashIDRepository
	stashIDTableAs    string
	parentIDCol       string
}

func (h *stashIDCriterionHandler) handle(ctx context.Context, f *filterBuilder) {
	if h.c == nil {
		return
	}

	stashIDRepo := h.stashIDRepository
	t := stashIDRepo.tableName
	if h.stashIDTableAs != "" {
		t = h.stashIDTableAs
	}

	joinClause := fmt.Sprintf("%s.%s = %s", t, stashIDRepo.idColumn, h.parentIDCol)
	if h.c.Endpoint != nil && *h.c.Endpoint != "" {
		joinClause += fmt.Sprintf(" AND %s.endpoint = '%s'", t, *h.c.Endpoint)
	}

	f.addLeftJoin(stashIDRepo.tableName, h.stashIDTableAs, joinClause)

	v := ""
	if h.c.StashID != nil {
		v = *h.c.StashID
	}

	stringCriterionHandler(&models.StringCriterionInput{
		Value:    v,
		Modifier: h.c.Modifier,
	}, t+".stash_id")(ctx, f)
}

type relatedFilterHandler struct {
	relatedIDCol   string
	relatedRepo    repository
	relatedHandler criterionHandler
	joinFn         func(f *filterBuilder)
	directJoin     bool
}

func (h *relatedFilterHandler) handle(ctx context.Context, f *filterBuilder) {
	ff := filterBuilderFromHandler(ctx, h.relatedHandler)
	if ff.err != nil {
		f.setError(ff.err)
		return
	}

	if ff.empty() {
		return
	}

	if h.joinFn != nil {
		h.joinFn(f)
	}

	if h.directJoin {
		// rerun handler using existing filter builder
		h.relatedHandler.handle(ctx, f)
		return
	}

	subQuery := h.relatedRepo.newQuery()
	selectIDs(&subQuery, subQuery.repository.tableName)
	if err := subQuery.addFilter(ff); err != nil {
		f.setError(err)
		return
	}

	f.addWhere(fmt.Sprintf("%s IN ("+subQuery.toSQL(false)+")", h.relatedIDCol), subQuery.args...)
}
