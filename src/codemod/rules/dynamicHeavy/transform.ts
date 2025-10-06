// pure transform: default import -> next/dynamic wrapper
export function transformDynamicHeavyDep(
    content: string,
    local: string,
    from: string
): { after: string; changed: boolean; reason?: string } {
    let after = content;

    const hasDynamic = /from\s+['"]next\/dynamic['"]/.test(after);
    if (!hasDynamic) {
        after = `import dynamic from 'next/dynamic';\n` + after;
    }

    // import Foo from 'lib'  ->  const Foo = dynamic(() => import('lib'), { ssr: false })
    // TODO: no regex
    const importRe = new RegExp(
        String.raw`(^|\n)\s*import\s+${escapeRE(local)}\s+from\s+['"]${escapeRE(from)}['"]\s*;?\s*`
    );

    if (!importRe.test(after)) {
        return { after: content, changed: false, reason: "Default import not found" };
    }

    after = after.replace(
        importRe,
        `$1const ${local} = dynamic(() => import('${from}'), { ssr: false })\n`
    );

    return { after, changed: after !== content };
}

function escapeRE(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

