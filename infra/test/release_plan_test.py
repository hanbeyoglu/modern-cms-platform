import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_plan', ROOT / 'infra/scripts/release-plan.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PREFIX = 'ghcr.io/hanbeyoglu/modern-cms-platform'
OLD = 'a' * 40
NEW = 'b' * 40


def previous():
    return {'sha': OLD, 'services': [], 'images': {s: PREFIX + '/' + s + ':' + OLD for s in (*module.SERVICES, 'migrate')}}


class ReleasePlanTests(unittest.TestCase):
    def check(self, files, services):
        release, matrix = module.plan(ROOT, files, previous(), NEW, PREFIX)
        self.assertEqual(release['services'], services)
        for service in module.SERVICES:
            self.assertTrue(release['images'][service].endswith(NEW if service in services else OLD))
        return release, matrix

    def test_initial_release_builds_every_image(self):
        release, matrix = module.plan(ROOT, [], None, NEW, PREFIX)
        self.assertEqual(release['services'], list(module.SERVICES))
        self.assertEqual(len(matrix['include']), 4)

    def test_admin_change_does_not_build_backend_or_migrations(self):
        _, matrix = self.check(['apps/admin/src/pages/EventsPage.tsx'], ['admin'])
        self.assertEqual([x['service'] for x in matrix['include']], ['admin'])

    def test_api_change_and_schema_change(self):
        self.check(['apps/api/src/events/events.service.ts'], ['api'])
        self.check(['apps/api/prisma/schema.prisma'], ['api', 'worker'])

    def test_shared_mail_dependency_rebuilds_consumers(self):
        self.check(['packages/mail/src/index.ts'], ['api', 'worker'])

    def test_ui_rebuilds_admin_only(self):
        self.check(['packages/ui/src/index.tsx'], ['admin'])

    def test_lockfile_and_deployment_changes_rebuild_all(self):
        for file in ['pnpm-lock.yaml', 'infra/docker/Dockerfile.api', 'docker-compose.prod.yml', 'packages/config/typescript/base.json']:
            self.check([file], list(module.SERVICES))

    def test_docs_only_advance_revision_without_image_builds(self):
        _, matrix = self.check(['README.md', 'docs/FRONTEND_HANDOFF.md'], [])
        self.assertEqual(matrix['include'], [])

    def test_image_shell_injection_and_wrong_registry_are_rejected(self):
        for value in [PREFIX + '/api:' + OLD + ';bad', 'ghcr.io/attacker/repo/api:' + OLD]:
            data = previous()
            data['images']['api'] = value
            with self.assertRaises(ValueError):
                module.validate_release(data, PREFIX)

    def test_non_sha_tags_and_invalid_service_selection_are_rejected(self):
        data = previous()
        data['images']['api'] = PREFIX + '/api:latest'
        with self.assertRaises(ValueError):
            module.validate_release(data, PREFIX)
        data = previous()
        data['services'] = ['postgres']
        with self.assertRaises(ValueError):
            module.validate_release(data, PREFIX)


if __name__ == '__main__':
    unittest.main()
