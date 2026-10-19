import importlib.util,tempfile,unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('upload_test',Path(__file__).resolve().parents[1]/'tools/upload-test.py')
upload=importlib.util.module_from_spec(spec);spec.loader.exec_module(upload)


class UploadGuard(unittest.TestCase):
    def test_command_can_only_create_a_test_build(self):
        args=upload.command('/tools','/assembly','/game','private-test-token','3.2.0')
        self.assertEqual(len(args),5)
        self.assertTrue(args[2].startswith('-src='))
        self.assertFalse(any('movetesttolive' in a or 'remove' in a for a in args))

    def test_vendor_log_redacts_the_token_and_signed_urls(self):
        secret='local-test-value-not-a-credential'
        value=upload.redact('-token='+secret+' copied '+secret+' https://vkplay.ru/pay?sign=abcdef&ok=1',secret)
        self.assertNotIn(secret,value);self.assertNotIn('abcdef',value)

    def test_unconfigured_source_is_not_uploadable(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'resources/app/desktop').mkdir(parents=True)
            (root/'resources/app/desktop/config.json').write_text('{"releaseConfigured":false}')
            (root/'BUILD-INFO.json').write_text('{"releaseConfigured":false}')
            with self.assertRaisesRegex(ValueError,'Configure and rebuild'):upload.validate_source(root)
