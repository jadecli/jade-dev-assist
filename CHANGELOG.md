# Changelog

## [1.1.0](https://github.com/jadecli/jade-dev-assist/compare/jade-dev-assist-v1.0.0...jade-dev-assist-v1.1.0) (2026-02-04)

### Features

- add complete plugin structure with commands, skills, agents, and hooks ([d086c09](https://github.com/jadecli/jade-dev-assist/commit/d086c09e8639a63faa172b5ae57f67703b803648))
- add orchestrate command definition ([a3eedb5](https://github.com/jadecli/jade-dev-assist/commit/a3eedb5d37cebd7c7fc34215125899c34badd709))
- **dispatcher:** add token estimation logging and budget warnings ([e6da367](https://github.com/jadecli/jade-dev-assist/commit/e6da3672e3281b279f19815a5394e4c6298c1c42))
- **github:** add GitHub Projects sync module and scripts ([5dead47](https://github.com/jadecli/jade-dev-assist/commit/5dead47319b7066d39f7a06a330e4366449ca596))
- **husky:** add pre-commit hook for test and validation ([ee915b8](https://github.com/jadecli/jade-dev-assist/commit/ee915b83111d6feb90ce823975548e84b2bbaa41))
- implement lib/presenter.js ([48fd472](https://github.com/jadecli/jade-dev-assist/commit/48fd47291b30f64a097a4dd90139874b9f6b320d))
- implement lib/scanner.js ([6d75b63](https://github.com/jadecli/jade-dev-assist/commit/6d75b6378ba907e9064f0315e2a0c50f54de4c22))
- implement lib/scorer.js ([009673f](https://github.com/jadecli/jade-dev-assist/commit/009673f85f5a377dc5a8f07d3f30a45920c62ad5))
- **lib:** add structured JSON logger and integrate across modules ([90285db](https://github.com/jadecli/jade-dev-assist/commit/90285db0e14a376540790835fe1f3bfebadaa4de))
- Phase 3 tiered dispatch, jade-pr script, and CI ([#1](https://github.com/jadecli/jade-dev-assist/issues/1)) ([6787527](https://github.com/jadecli/jade-dev-assist/commit/6787527b9c69f6a8a6a6acf189a7126f4986497e))
- **scanner:** add error recovery for malformed task files ([7817b47](https://github.com/jadecli/jade-dev-assist/commit/7817b47761cd2dd34b968f19315d1a22f3ce7612))

## [1.0.0](https://github.com/jadecli/jade-dev-assist/compare/v0.0.0...v1.0.0) (2026-02-02)

### Features

- add complete plugin structure with commands, skills, agents, and hooks ([d086c09](https://github.com/jadecli/jade-dev-assist/commit/d086c09e8639a63faa172b5ae57f67703b803648))
- implement lib/scanner.js ([6d75b63](https://github.com/jadecli/jade-dev-assist/commit/6d75b6378ba907e9064f0315e2a0c50f54de4c22))
- implement lib/scorer.js ([009673f](https://github.com/jadecli/jade-dev-assist/commit/009673f85f5a377dc5a8f07d3f30a45920c62ad5))
- implement lib/presenter.js ([48fd472](https://github.com/jadecli/jade-dev-assist/commit/48fd47291b30f64a097a4dd90139874b9f6b320d))
- add orchestrate command definition ([a3eedb5](https://github.com/jadecli/jade-dev-assist/commit/a3eedb5d37cebd7c7fc34215125899c34badd709))
- implement lib/dispatcher.js - worker dispatch module ([495bc8d](https://github.com/jadecli/jade-dev-assist/commit/495bc8d1bbdc25b634e1229da694966afa4974f2))

### Documentation

- update task statuses in .claude/tasks/tasks.json ([5d2027d](https://github.com/jadecli/jade-dev-assist/commit/5d2027d6186c5748cf5c438b8a7458bcbfae4c87))
- mark implement-dispatcher task as completed ([05ca6ca](https://github.com/jadecli/jade-dev-assist/commit/05ca6ca81d26f020f656b0ad0ea9729c358f555d))

### Tests

- add test fixtures for scanner and scorer ([6f02611](https://github.com/jadecli/jade-dev-assist/commit/6f02611ec22c5adaf11182d56d16d094f6177218))
- add scanner test suite (13 test cases) ([e1da360](https://github.com/jadecli/jade-dev-assist/commit/e1da3606d69ea7ad834017d4701cfb07fd12e7c4))
- add scorer test suite (49 test cases) ([e25343f](https://github.com/jadecli/jade-dev-assist/commit/e25343fb2daf0bff3b648556d4e718439c32cb91))
- add presenter test suite ([983d30e](https://github.com/jadecli/jade-dev-assist/commit/983d30e7c4e58a5fb0c6d31b511dae3903a94063))
- add test runner, update package.json test script ([4297580](https://github.com/jadecli/jade-dev-assist/commit/42975805d27ff23b5ef24a4a6d1f3e8d1b4546f2))
- add dispatcher test suite (37 test cases) ([dbab079](https://github.com/jadecli/jade-dev-assist/commit/dbab07920e59d80739ceeea5e6e0163599398d2b))

### Miscellaneous Chores

- initial commit ([37e7c76](https://github.com/jadecli/jade-dev-assist/commit/37e7c76bf4aeb84833174f97dca068f22a21d673))
- update agent configs with model settings ([7967d42](https://github.com/jadecli/jade-dev-assist/commit/7967d42a7b57a4a10ab71d85c5ec8d8c2e9fe9dd))
