#!/usr/bin/env python3
"""Plan immutable production images relative to the last successful deployment."""
import argparse
import json
from pathlib import Path
import re
import subprocess

SERVICES = ('api', 'worker', 'admin')
SHA = re.compile(r'^[0-9a-f]{40}$')
PREFIX = re.compile(r'^ghcr\.io/[a-z0-9_.-]+/[a-z0-9_./-]+$')


def validate_release(data, prefix):
    if not PREFIX.fullmatch(prefix) or not SHA.fullmatch(data.get('sha', '')):
        raise ValueError('Invalid release identity')
    images = data.get('images', {})
    for service in (*SERVICES, 'migrate'):
        value = images.get(service, '')
        if not re.fullmatch(re.escape(prefix + '/' + service + ':') + r'[0-9a-f]{40}', value):
            raise ValueError('Invalid image reference: ' + service)
    services = data.get('services', [])
    if not isinstance(services, list) or any(s not in SERVICES for s in services) or len(set(services)) != len(services):
        raise ValueError('Invalid service selection')
    return data


def affected(root, paths):
    nodes = {}
    for base in ('apps', 'packages'):
        for file in (root / base).glob('*/package.json'):
            data = json.loads(file.read_text())
            deps = set()
            for key in ('dependencies', 'devDependencies', 'peerDependencies'):
                deps.update(data.get(key, {}))
            nodes[data['name']] = (str(file.parent.relative_to(root)) + '/', deps)
    changed = set()
    for path in paths:
        if path in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', '.dockerignore', '.npmrc') or path.startswith(('infra/', 'docker-compose', 'packages/config/', '.github/workflows/')):
            return set(SERVICES)
        if path.startswith('apps/api/prisma/'):
            changed.update(('@modern-cms/api', '@modern-cms/worker'))
        for name, (directory, _) in nodes.items():
            if path.startswith(directory):
                changed.add(name)
    while True:
        dependents = {name for name, (_, deps) in nodes.items() if deps & changed}
        if dependents <= changed:
            break
        changed |= dependents
    return {service for service in SERVICES if '@modern-cms/' + service in changed}


def plan(root, paths, previous, sha, prefix):
    if not SHA.fullmatch(sha) or not PREFIX.fullmatch(prefix):
        raise ValueError('Invalid SHA or registry prefix')
    if previous:
        validate_release(previous, prefix)
    services = [s for s in SERVICES if not previous or s in affected(root, paths)]
    images = dict(previous['images']) if previous else {}
    builds = services + (['migrate'] if set(services) & {'api', 'worker'} else [])
    for service in builds:
        images[service] = prefix + '/' + service + ':' + sha
    result = {'sha': sha, 'images': images, 'services': services}
    validate_release(result, prefix)
    matrix = {'include': [{'service': s, 'dockerfile': 'infra/docker/Dockerfile.' + ('api' if s == 'migrate' else s), 'target': 'migrate' if s == 'migrate' else 'runner', 'image': images[s]} for s in builds]}
    return result, matrix


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prefix', required=True)
    parser.add_argument('--validate', type=Path)
    parser.add_argument('--sha')
    parser.add_argument('--force-all', action='store_true')
    parser.add_argument('--previous', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--github-output', type=Path)
    args = parser.parse_args()
    if args.validate:
        data = validate_release(json.loads(args.validate.read_text()), args.prefix)
        for service, image in data['images'].items():
            if service in (*SERVICES, 'migrate'):
                print('CMS_' + service.upper() + '_IMAGE=' + image)
        print('RELEASE_SERVICES=' + ' '.join(data['services']))
        print('RELEASE_SHA=' + data['sha'])
        return
    root = Path(__file__).resolve().parents[2]
    previous = json.loads(args.previous.read_text()) if args.previous and args.previous.exists() else None
    paths = []
    if previous:
        validate_release(previous, args.prefix)
        base = previous['sha']
        ancestor = subprocess.run(['git', 'merge-base', '--is-ancestor', base, args.sha], cwd=root, capture_output=True)
        if ancestor.returncode:
            previous = None  # First deployment / expired history / history rewrite: rebuild all.
        else:
            raw = subprocess.check_output(['git', 'diff', '--name-only', '-z', '--no-renames', base, args.sha], cwd=root)
            paths = [p for p in raw.decode().split('\0') if p]
    if args.force_all:
        previous = None
    result, matrix = plan(root, paths, previous, args.sha, args.prefix)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    if args.github_output:
        with args.github_output.open('a') as output:
            output.write('matrix=' + json.dumps(matrix, separators=(',', ':')) + '\n')
            output.write('build=' + str(bool(matrix['include'])).lower() + '\n')


if __name__ == '__main__':
    main()
