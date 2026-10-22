package api

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func TestStatsMissingValuesCustom(t *testing.T) {
	for _, value := range []string{"", " ", " <NiL> ", " null ", "Unknown", "__unknown__"} {
		require.True(t, statsMissingTextCustom(value), value)
		require.Nil(t, vatoStatsStringPtrValue(value), value)
		require.Equal(t, "Unknown", vatoStatsEthnicityLabel(value), value)
	}
	for _, value := range []string{"0", "MX", "Mexican"} {
		require.False(t, statsMissingTextCustom(value), value)
		require.NotNil(t, sceneStatsStringPtrValue(value), value)
		require.NotNil(t, vatoStatsStringPtrValue(value), value)
		require.Equal(t, value, vatoStatsEthnicityLabel(value))
	}
}

func TestStatsMissingSQLValuesCustom(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	defer db.Close()
	for _, value := range []interface{}{nil, "", " ", "<NiL>", "null", "Unknown", "__unknown__", "0", "MX", "Mexican"} {
		var missing bool
		err := db.QueryRow("SELECT "+statsMissingTextSQLCustom("value")+" FROM (SELECT ? AS value)", value).Scan(&missing)
		require.NoError(t, err)
		require.Equal(t, value == nil || statsMissingTextCustom(customStringValue(value)), missing, value)
	}
	// A title named Unknown is valid metadata, not a missing demographic value.
	require.Equal(t, "Unknown", *sceneStatsStringPtrValue("Unknown"))
}
