#!/bin/bash
# GitHub Projects CLI helpers for jadecli ecosystem

set -e

ORG="jadecli"
PROJECT_NUMBER=4

# Get project ID
get_project_id() {
    gh api graphql -f query="
        query{
            organization(login: \"$ORG\"){
                projectV2(number: $PROJECT_NUMBER) {
                    id
                }
            }
        }" --jq '.data.organization.projectV2.id'
}

# Get project fields
get_project_fields() {
    local project_id="$1"
    gh api graphql -f query="
        query{
            node(id: \"$project_id\") {
                ... on ProjectV2 {
                    fields(first: 20) {
                        nodes {
                            ... on ProjectV2FieldCommon { id name }
                            ... on ProjectV2SingleSelectField {
                                id name
                                options { id name }
                            }
                        }
                    }
                }
            }
        }"
}

# List project items
list_items() {
    local project_id="$1"
    gh api graphql -f query="
        query{
            node(id: \"$project_id\") {
                ... on ProjectV2 {
                    items(first: 100) {
                        nodes {
                            id
                            content {
                                ... on Issue { title number repository { name } }
                                ... on DraftIssue { title }
                            }
                        }
                    }
                }
            }
        }"
}

# Add issue to project
add_issue() {
    local project_id="$1"
    local issue_node_id="$2"
    gh api graphql -f query="
        mutation {
            addProjectV2ItemById(input: {
                projectId: \"$project_id\"
                contentId: \"$issue_node_id\"
            }) {
                item { id }
            }
        }"
}

# Create draft issue in project
create_draft() {
    local project_id="$1"
    local title="$2"
    local body="$3"
    gh api graphql -f query="
        mutation {
            addProjectV2DraftIssue(input: {
                projectId: \"$project_id\"
                title: \"$title\"
                body: \"$body\"
            }) {
                projectItem { id }
            }
        }"
}

# Main
case "$1" in
    get-id)
        get_project_id
        ;;
    fields)
        PROJECT_ID=$(get_project_id)
        get_project_fields "$PROJECT_ID"
        ;;
    list)
        PROJECT_ID=$(get_project_id)
        list_items "$PROJECT_ID"
        ;;
    add-issue)
        PROJECT_ID=$(get_project_id)
        add_issue "$PROJECT_ID" "$2"
        ;;
    create-draft)
        PROJECT_ID=$(get_project_id)
        create_draft "$PROJECT_ID" "$2" "$3"
        ;;
    *)
        echo "Usage: $0 {get-id|fields|list|add-issue|create-draft}"
        exit 1
        ;;
esac
